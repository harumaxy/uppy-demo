import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import Webcam from "@uppy/webcam";
import Tus from "@uppy/tus";

import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

const tusdEndpoint = "http://localhost:8080/files";

const uppy = new Uppy()
	.use(Dashboard, {
		inline: true,
		target: "#app",
	})
	.use(Webcam)
	.use(Tus, {
		endpoint: tusdEndpoint,
	});

uppy.on("complete", (result) => {
	console.log("Upload result:", result.successful);
});

uppy.on("upload-success", async (file, _res) => {
	console.log("Upload success:", file);
});
