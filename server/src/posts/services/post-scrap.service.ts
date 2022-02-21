import { Injectable } from "@nestjs/common";
import { Model, Types } from "mongoose";
import { PostScrapDocument } from "../../schemas/post-scrap.schema";
import { PostIdentifier } from "../../models/post.model";
import { PostsRepository } from "../posts.repository";
import { SortOrder } from "../../common/repository/sort-option";
import { PostDocument } from "../../schemas/post.schema";
import { InjectModel } from "@nestjs/mongoose";
import { EventBus } from "@nestjs/cqrs";
import { PostScrappedEvent } from "../events/post-scrapped.event";
import { getCurrentTime } from "../../common/utils/time.util";
import { PostUnscrappedEvent } from "../events/post-unscrapped.event";
import { BackOffPolicy, Retryable } from "typescript-retry-decorator";

@Injectable()
export class PostScrapService {
  constructor(
    @InjectModel(PostScrapDocument.name)
    private readonly postScrapModel: Model<PostScrapDocument>,
    private readonly postsRepository: PostsRepository,
    private readonly eventBus: EventBus,
  ) {}

  @Retryable({
    maxAttempts: 3,
    backOff: 100,
    backOffPolicy: BackOffPolicy.FixedBackOffPolicy,
  })
  async scrapPost(postIdentifier: PostIdentifier, nickname: string) {
    const { postId, boardType } = postIdentifier;
    const updateResult = await this.postScrapModel
      .updateOne(
        { nickname, postId: new Types.ObjectId(postId) },
        { $setOnInsert: { boardType } },
        { upsert: true },
      )
      .exec();
    if (updateResult.upsertedCount === 1) {
      await this.postsRepository.increaseScrapCount(postIdentifier);
      this.eventBus.publish(
        new PostScrappedEvent(postIdentifier, nickname, getCurrentTime()),
      );
    }
    return;
  }

  async unscrapPost(postIdentifier: PostIdentifier, nickname: string) {
    const { postId, boardType } = postIdentifier;
    const deletedScrapPost = await this.postScrapModel
      .findOneAndDelete({
        nickname,
        postId: new Types.ObjectId(postId),
        boardType,
      })
      .exec();
    if (deletedScrapPost) {
      await this.postsRepository.decreaseScrapCount(postIdentifier);
      this.eventBus.publish(
        new PostUnscrappedEvent(
          postIdentifier,
          nickname,
          deletedScrapPost.createdAt,
        ),
      );
    }
    return;
  }

  async getScrapPosts(nickname: string) {
    const scrapPosts = await this.postScrapModel
      .find({ nickname })
      .sort({ _id: SortOrder.ASC }) // 스크랩한지 오래된 순으로
      .populate({ path: "post", populate: { path: "writer" } })
      .exec();
    return scrapPosts
      .filter((scrapPost) => scrapPost.post !== null)
      .map((scrapPost) => PostDocument.toModel(scrapPost.post));
  }

  async isUserScrapPost(
    { postId, boardType }: PostIdentifier,
    nickname: string,
  ): Promise<boolean> {
    const exists = await this.postScrapModel.exists({
      nickname,
      postId: new Types.ObjectId(postId),
      boardType,
    });
    return exists ?? false;
  }

  removeOrphanPostScraps({ postId, boardType }: PostIdentifier) {
    return this.postScrapModel
      .deleteMany({ postId: new Types.ObjectId(postId), boardType })
      .exec();
  }
}
