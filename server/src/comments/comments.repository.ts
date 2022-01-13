import { Injectable } from "@nestjs/common";
import { Model } from "mongoose";
import { CommentDocument } from "../schemas/comment.schema";
import { Comment } from "../models/comment.model";
import { MongooseBaseRepository } from "../common/repository/mongoose-base.repository";
import { InjectModel } from "@nestjs/mongoose";

@Injectable()
export class CommentsRepository extends MongooseBaseRepository<
  Comment,
  CommentDocument
> {
  constructor(
    @InjectModel(CommentDocument.name)
    private readonly commentModel: Model<CommentDocument>,
  ) {
    super(
      CommentDocument.toModel,
      CommentDocument.fromModel,
      commentModel,
      ["commentId", "postId"],
      "commentId",
    );
  }

  async persist(model: Comment): Promise<Comment> {
    const commentDocument = CommentDocument.fromModel(model, this.commentModel);
    const {
      _id,
      content,
      writerNickname,
      postId,
      createdAt,
      mentionedUserNicknames,
    } = commentDocument.toJSON();
    await this.commentModel.updateOne(
      { _id },
      { content, writerNickname, postId, createdAt, mentionedUserNicknames },
      { upsert: true },
    );
    return CommentDocument.toModel(commentDocument);
  }

  async update(model: Comment): Promise<Comment> {
    const commentDocument = CommentDocument.fromModel(model, this.commentModel);
    const {
      _id,
      content,
      writerNickname,
      postId,
      createdAt,
      mentionedUserNicknames,
    } = commentDocument.toJSON();
    await this.commentModel.updateOne(
      { _id },
      { content, writerNickname, postId, createdAt, mentionedUserNicknames },
    );
    return CommentDocument.toModel(commentDocument);
  }

  findByCommentId(commentId: string) {
    return this.findOne({ commentId: { eq: commentId } });
  }

  async remove(comment: Comment) {
    const deleteResult = await this.commentModel
      .deleteOne({ _id: comment.commentId })
      .exec();
    return deleteResult.deletedCount === 1;
  }
}
