import { Document } from "mongoose";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { compare, hash } from "bcrypt";
import { v1 } from "uuid";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Min
} from "class-validator";
import { BadRequestException } from "@nestjs/common";
import * as crypto from "crypto";

export class GithubRepositoryInfo {
  @ApiProperty({
    description: "리포지토리 이름",
    example: "koding"
  })
  @Prop()
  name: string;

  @IsUrl()
  @ApiProperty({
    description: "리포지토리 주소",
    example: "koding"
  })
  @Prop()
  htmlUrl: string;

  @ApiProperty({
    description: "리포지토리 설명",
    example: "개발자 커뮤니티 🐾"
  })
  @Prop()
  description?: string;

  @Min(0)
  @IsNumber()
  @ApiProperty({
    description: "리포지토리 스타 수",
    example: 23
  })
  @Prop()
  starCount: number;
}

export class GithubUserInfo {

  @Prop()
  githubId: string;

  @IsUrl()
  @ApiProperty({
    description: "깃허브 프로필 사진 url",
    example: "https://avatars.githubusercontent.com/u/11111111"
  })
  @Prop()
  avatarUrl: string;

  @ApiProperty({
    description: "유저 이름",
    example: "홍길동"
  })
  @Prop()
  name: string;

  @IsEmail()
  @ApiProperty({
    description: "깃허브 회원가입 이메일",
    example: "test@test.com"
  })
  @Prop()
  email: string;

  @ApiProperty({
    description: "소유한 리포지토리들의 정보",
    type: [GithubRepositoryInfo]
  })
  @Prop({ type: [GithubRepositoryInfo] })
  repositories: GithubRepositoryInfo[];
}

export type UserDocument = User & Document;

@Schema({ id: false, _id: true, versionKey: false, autoIndex: true })
export class User {
  private static readonly round = 10;

  @IsEmail()
  @ApiProperty({
    example: "test@test.com",
    description: "유저 이메일, 중복 불가"
  })
  @Prop({ unique: true, index: { unique: true } })
  email: string;


  @IsString()
  @Length(2, 10)
  @Matches("[A-Za-z0-9가-힣]*")
  @ApiProperty({
    example: "testNick",
    description: "유저 닉네임, 중복 불가",
    minLength: 2,
    maxLength: 10
  })
  @Prop({ required: false, index: { unique: true, partialFilterExpression: { nickname: { $type: "string" } } } })
  nickname: string;

  @Length(8, 16)
  @IsString()
  @ApiProperty({
    example: "abcd1234",
    description: "유저 비밀번호",
    minLength: 8,
    maxLength: 16
  })
  @Prop()
  password?: string;

  @IsOptional()
  @IsUrl()
  @ApiPropertyOptional({
    example: "https://blog.naver.com/test",
    description: "유저 블로그 주소"
  })
  @Prop({ required: false })
  blogUrl?: string;

  @IsOptional()
  @IsUrl()
  @ApiPropertyOptional({
    example: "https://test.github.com",
    description: "유저 깃허브 주소"
  })
  @Prop({ required: false })
  githubUrl?: string;

  @IsOptional()
  @IsUrl()
  @ApiPropertyOptional({
    example: "https://linktr.ee/test",
    description: "유저 포트폴리오 주소"
  })
  @Prop({ required: false })
  portfolioUrl?: string;

  @IsOptional()
  @IsNumber()
  @Prop({
    required: false,
    index: { unique: true, partialFilterExpression: { githubUserIdentifier: { $type: "int" } } }
  })
  githubUserIdentifier?: number;

  @IsOptional()
  @ApiProperty({
    description: "깃허브 연동 정보"
  })
  @Prop({ required: false, type: GithubUserInfo })
  githubUserInfo?: GithubUserInfo;

  @IsOptional()
  @IsString()
  @Prop({ required: false })
  emailSignupVerifyToken?: string;

  @IsBoolean()
  @Prop({ default: false })
  emailSignupVerified: boolean;

  @IsOptional()
  @IsString()
  @Prop({ required: false })
  githubSignupVerifyToken?: string;

  @IsBoolean()
  @Prop({ default: false })
  githubSignupVerified: boolean;

  @IsOptional()
  @IsNumberString({
    no_symbols: true
  })
  @Length(6, 6)
  @Prop()
  passwordResetToken?: string;

  get isGithubUser(): boolean {
    return this.githubUserIdentifier !== undefined;
  }

  get isEmailUser(): boolean {
    return this.password !== undefined;
  }

  get isVerifiedUser(): boolean {
    // 이메일 유저 & 이메일 인증 완료
    if (this.isEmailUser && this.emailSignupVerified)
      return true;
    // 깃허브 유저 & 깃허브 인증 완료
    if (this.isGithubUser && this.githubSignupVerified)
      return true;
    return false;
  }

  async hashPassword() {
    if (this.password) this.password = await hash(this.password, User.round);
    return this;
  }

  verifyPassword(password: string) {
    return compare(password, this.password);
  }

  setNewEmailSignupVerifyToken() {
    this.emailSignupVerifyToken = v1();
  }

  setNewGithubSignupVerifyToken() {
    this.githubSignupVerifyToken = v1();
  }

  setNewPasswordResetToken() {
    const randomDigits = Array.from({ length: 6 }, () => crypto.randomInt(0, 9));
    this.passwordResetToken = randomDigits.join("");
  }

  verifyGithubSignup({ verifyToken, newNickname }: { verifyToken: string, newNickname: string }) {
    if (this.githubSignupVerifyToken !== verifyToken)
      throw new BadRequestException("유효하지 않은 토큰");
    this.nickname = newNickname;
    this.githubSignupVerified = true;
    this.githubSignupVerifyToken = undefined;
  }

  verifyPasswordResetToken(verifyToken: string) {
    if (this.passwordResetToken !== verifyToken)
      throw new BadRequestException("유효하지 않은 토큰");
  }

  async verifyResetPassword({ verifyToken, newPassword }: { verifyToken: string, newPassword: string }) {
    this.verifyPasswordResetToken(verifyToken);
    this.password = newPassword;
    this.passwordResetToken = undefined;
    await this.hashPassword();
  }
}


export const UserSchema = SchemaFactory.createForClass(User);
// UserSchema.pre<User>('save', async function hashPassword(next) {
//   await this.hashPassword();
//   next();
// });
UserSchema.loadClass(User);
