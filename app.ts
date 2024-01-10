import app = require("teem");
import http = require("http");
import ws = require("ws");
import appsettings = require("./appsettings");

app.run({
	localIp: appsettings.localIp,
	root: appsettings.root,
	port: appsettings.port,
	sqlConfig: appsettings.sqlConfig,
	disableStaticFiles: true,

	onFinish: function () {
		const wsServer = new ws.Server({ noServer: true });

		wsServer.on("connection", function (socket) {

			// O front não envia dados, fica apenas monitorando. Então, não precisa
			// criar um handler para socket.on("message", ...). Precisa apenas criar uma
			// conexão com o back, para encaminhar para o front tudo que o back enviar.

			const idusuario: number = (socket as any).idusuario;

			if (!idusuario)
				return;

			const clientId: string | null = (socket as any).clientId;

			const query = (clientId ? `?clientId=${encodeURIComponent(clientId)}&idusuario=${idusuario}` : `?idusuario=${idusuario}`);

			const client = new ws.WebSocket(appsettings.comfyUIWS[idusuario & 1] + query);

			client.binaryType = "arraybuffer";

			socket.on("error", function () {
				(socket as any).idusuario = 0;
				client.close();
			});

			socket.on("close", function () {
				(socket as any).idusuario = 0;
				client.close();
			});

			client.on("error", function () {
				(socket as any).idusuario = 0;
				socket.close();
			});

			client.on("close", function () {
				(socket as any).idusuario = 0;
				socket.close();
			});

			client.on("message", function (data, isBinary) {
				if (!(socket as any).idusuario)
					return;

				socket.send(data, { binary: isBinary });
			});
		});

        const server = app.express.listen(app.port, app.localIp, function () {
            console.log(`Servidor WS executando em ${app.localIp}:${app.port}`);
        });

		server.on("upgrade", async (req: app.Request, socket, head) => {
			try {
				let i;
				if (!req.url || (i = req.url.indexOf("idusuario=")) < 0)
					return;

				let idusuario = parseInt(req.url.substring(i + 10)) || 0;

				idusuario = await app.sql.connect(async (sql) => {
					return await sql.scalar("select id from usuario where id = ? and exclusao is null", [idusuario || 0]) as number;
				});

				if (idusuario) {
					let clientId: string | null = null;
					if ((i = req.url.indexOf("clientId=")) >= 0) {
						clientId = req.url.substring(i + 9);
						if ((i = clientId.indexOf("&")) >= 0)
							clientId = clientId.substring(0, i);
					}

					wsServer.handleUpgrade(req, socket, head, socket => {
						(socket as any).idusuario = idusuario;
						(socket as any).clientId = clientId;
						wsServer.emit("connection", socket, req);
					});
				}
			} catch (ex: any) {
				// Apenas ignora...
				console.error(ex);
			}
		});
	}
});
