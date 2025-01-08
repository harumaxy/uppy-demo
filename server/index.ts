import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import cors from "@elysiajs/cors";
import { Elysia, t } from "elysia";

const Bucket = process.env.S3_BUCKET ?? "";

const s3 = new S3Client({
  forcePathStyle: true, // minio だと必要
  endpoint: process.env.S3_ENDPOINT ?? "",
  region: "ap-northeast-1",
  credentials: {
    accessKeyId: process.env.S3_ROOT_USER ?? "",
    secretAccessKey: process.env.S3_ROOT_PASSWORD ?? "",
  },
});

const fileInfoSchema = t.Object({
  name: t.String(),
  type: t.String(),
  size: t.Number(),
});

const s3PartSchema = t.Object({
  PartNumber: t.Optional(t.Number()),
  Size: t.Optional(t.Number()),
  ETag: t.Optional(t.String()),
});

const server = new Elysia()
  .use(cors())
  .get(
    "/uppy/s3",
    async (c) => {
      return {
        method: "PUT" as const,
        headers: {
          "content-type": c.query.type,
        },
        url: await getSignedUrl(
          s3,
          new PutObjectCommand({
            Bucket,
            Key: c.query.name,
            ContentType: c.query.type,
          })
        ),
      };
    },
    {
      query: fileInfoSchema,
    }
  )
  .post(
    "/uppy/s3-multipart",
    async (c) => {
      const multipart = await s3.send(
        new CreateMultipartUploadCommand({
          Bucket,
          Key: c.body.name,
          ContentType: c.body.type,
        })
      );
      return {
        uploadId: multipart.UploadId ?? "",
        key: multipart.Key ?? "",
      };
    },
    {
      body: fileInfoSchema,
    }
  )
  .post(
    "/uppy/s3-multipart/:uploadId",
    async (c) => {
      const uploadId = c.params.uploadId;
      const { Parts } = await s3.send(
        new ListPartsCommand({
          Bucket,
          UploadId: uploadId,
          Key: c.body.key,
        })
      );
      return Parts ?? [];
    },
    {
      body: t.Object({ key: t.String() }),
    }
  )
  .post(
    "/uppy/s3-multipart/:uploadId/:partNumber",
    async (c) => {
      return {
        url: await getSignedUrl(
          s3,
          new UploadPartCommand({
            Bucket,
            Key: c.body.key,
            PartNumber: Number.parseInt(c.params.partNumber),
            UploadId: c.params.uploadId,
          })
        ),
      };
    },
    {
      body: t.Object({ key: t.String() }),
    }
  )
  .delete(
    "/uppy/s3-multipart/:uploadId",
    async (c) => {
      await s3.send(
        new AbortMultipartUploadCommand({
          Bucket,
          Key: c.body.key,
          UploadId: c.params.uploadId,
        })
      );
      c.set.status = 204;
      return {};
    },
    {
      body: t.Object({ key: t.String() }),
    }
  )
  .post(
    "/uppy/s3-multipart/:uploadId/complete",
    async (c) => {
      const res = await s3.send(
        new CompleteMultipartUploadCommand({
          Bucket,
          Key: c.body.key,
          UploadId: c.params.uploadId,
          MultipartUpload: {
            Parts: c.body.parts,
          },
        })
      );
      return {
        location: res.Location,
      };
    },
    {
      body: t.Object({
        key: t.String(),
        parts: t.Array(s3PartSchema),
      }),
    }
  )
  .post(
    "/uppy/upload-success",
    async (c) => {
      console.log(await c.body);
      return "OK";
    },
    {
      body: t.Object({
        result: t.Record(t.String(), t.String()),
      }),
    }
  )
  .listen(8000);

console.log("Server is running on http://localhost:8000");

export type Server = typeof server;
