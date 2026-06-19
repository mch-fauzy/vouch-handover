import app from "./main";
import log from "./logger";

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => log({ event: "listening", port }));
