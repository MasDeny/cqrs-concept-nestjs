import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { UploadController } from "./upload.controller";
import { CqrsModule } from "@nestjs/cqrs";
import { UploadCommandHandlers } from "./commands/handlers";
import { MongooseModule } from "@nestjs/mongoose";
import { S3Image, S3ImageSchema } from "../schemas/s3-image.schema";
import { UploadService } from "./upload.service";
import { S3Service } from "./s3.service";
import { UploadEventHandlers } from "./event/handlers";
import { UploadRepository } from "./upload.repository";

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: S3Image.name,
        schema: S3ImageSchema,
      },
    ]),
    MulterModule.register(),
    CqrsModule,
  ],
  providers: [
    UploadRepository,
    S3Service,
    UploadService,
    ...UploadCommandHandlers,
    ...UploadEventHandlers,
  ],
  controllers: [UploadController],
  exports: [UploadRepository],
})
export class UploadModule {}
