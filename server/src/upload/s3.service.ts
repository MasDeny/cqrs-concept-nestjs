import { Injectable, Logger } from "@nestjs/common";
import { S3 } from "aws-sdk";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class S3Service {
  public readonly s3: S3;
  public readonly bucketName: string;
  private readonly logger = new Logger(S3Service.name);

  public readonly postImageKeyPrefix: string;
  public readonly profileAvatarKeyPrefix: string;

  constructor(configService: ConfigService) {
    this.s3 = new S3({
      credentials: {
        accessKeyId: configService.get<string>("aws.s3.aws-key"),
        secretAccessKey: configService.get<string>("aws.s3.aws-secret"),
        expired: false,
      },
      region: configService.get<string>("aws.s3.region"),
    });
    this.bucketName = configService.get<string>("aws.s3.bucket");
    this.postImageKeyPrefix = configService.get<string>(
      "aws.s3.key-prefix.post-image",
    );
    this.profileAvatarKeyPrefix = configService.get<string>(
      "aws.s3.key-prefix.profile-avatar",
    );
  }

  async deleteS3PostImageFiles(fileKeys: string[]) {
    return new Promise<string[]>((res, rej) => {
      if (fileKeys.length <= 0) res([]);
      else {
        const deleteParams = {
          Bucket: this.bucketName,
          Delete: {
            Quiet: false,
            Objects: fileKeys.map((fileKey) => ({
              Key: `${this.postImageKeyPrefix}/${fileKey}`,
            })),
          },
        };
        this.s3.deleteObjects(deleteParams, (err, data) => {
          if (data)
            this.logger.log(
              `${
                data.Deleted.length
              } Image deleted from AWS S3, ${JSON.stringify(data.Deleted)}`,
            );
          if (err) rej(err);
          else res(data.Deleted.map(({ Key }) => Key));
        });
      }
    });
  }
}
