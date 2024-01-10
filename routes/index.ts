import app = require("teem");

class IndexRoute {
	public static async index(req: app.Request, res: app.Response) {
		res.render("index/index");
	}
}

export = IndexRoute;
