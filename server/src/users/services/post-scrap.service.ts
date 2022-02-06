import { Injectable } from "@nestjs/common";
import { Model, Types } from "mongoose";
import { ScrapPostDocument } from "../../schemas/scrap-post.schema";
import { PostIdentifier } from "../../models/post.model";
import { PostsRepository } from "../../posts/posts.repository";
import { SortType } from "../../common/repository/sort-option";
import { PostDocument } from "../../schemas/post.schema";
import { InjectModel } from "@nestjs/mongoose";
import { EventBus } from "@nestjs/cqrs";
import { PostScrapedEvent } from "../../posts/events/post-scraped.event";
import { getCurrentTime } from "../../common/utils/time.util";
import { PostUnscrapedEvent } from "../../posts/events/post-unscraped.event";

@Injectable()
export class PostScrapService {
  constructor(
    @InjectModel(ScrapPostDocument.name)
    private readonly scrapPostModel: Model<ScrapPostDocument>,
    private readonly postsRepository: PostsRepository,
    private readonly eventBus: EventBus,
  ) {}

  async scrapPost(postIdentifier: PostIdentifier, nickname: string) {
    const { postId, boardType } = postIdentifier;
    const updateResult = await this.scrapPostModel
      .updateOne(
        { postId: new Types.ObjectId(postId), nickname },
        { $setOnInsert: { boardType } },
        { upsert: true },
      )
      .exec();
    if (updateResult.upsertedCount === 1) {
      await this.postsRepository.increaseScrapCount(postIdentifier);
      this.eventBus.publish(
        new PostScrapedEvent(postIdentifier, nickname, getCurrentTime()),
      );
    }
    return;
  }

  async unscrapPost(postIdentifier: PostIdentifier, nickname: string) {
    const { postId, boardType } = postIdentifier;
    const deletedScrapPost = await this.scrapPostModel
      .findOneAndDelete({
        postId: new Types.ObjectId(postId),
        nickname,
      })
      .exec();
    if (deletedScrapPost) {
      await this.postsRepository.increaseScrapCount(postIdentifier);
      this.eventBus.publish(
        new PostUnscrapedEvent(
          postIdentifier,
          nickname,
          deletedScrapPost.createdAt,
        ),
      );
    }
    return;
  }

  async getScrapPost(nickname: string) {
    const scrapPosts = await this.scrapPostModel
      .find({ nickname })
      .sort({ _id: SortType.ASC }) // 스크랩한지 오래된 순으로
      .populate("post")
      .exec();
    return scrapPosts.map((post) => PostDocument.toModel(post.post));
  }
}
