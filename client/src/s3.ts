import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import Webcam from "@uppy/webcam";
import AwsS3 from "@uppy/aws-s3";

import { edenTreaty } from "@elysiajs/eden";
import type { Server } from "server";

import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

const server = edenTreaty<Server>("http://localhost:8000");

const uppy = new Uppy({})
  .use(Dashboard, {
    inline: true,
    target: "#app",
  })
  .use(Webcam)
  .use(AwsS3, {
    endpoint: "",
    async getUploadParameters(file, _options) {
      const res = await server.uppy.s3.get({
        $query: {
          name: file.name ?? "unknown",
          type: file.type,
          size: file.size ?? 0,
        },
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },

    shouldUseMultipart(file) {
      // 10 MB 以上ならマルチパートアップロードする
      return (file.size ?? 0) >= 10 * 1024 ** 2;
    },

    async createMultipartUpload(file) {
      const res = await server.uppy["s3-multipart"].post({
        name: file.name ?? "unknown",
        type: file.type,
        size: file.size ?? 0,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },

    async listParts(_file, { uploadId, key }) {
      const res = await server.uppy["s3-multipart"][uploadId].post({
        key,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },

    async signPart(_file, { key, uploadId, partNumber }) {
      const res = await server.uppy["s3-multipart"][uploadId][partNumber].post({
        key,
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

uppy.on("complete", (result) => {
  console.log("Upload result:", result.successful);
});

uppy.on("upload-success", async (file, _response) => {
  await server.uppy["upload-success"].post({
    result: {
      name: file?.meta.name ?? "",
      type: file?.meta.type ?? "",
      size: String(file?.size ?? 0),
    },
  });
  console.log("Upload success:", file);
});
