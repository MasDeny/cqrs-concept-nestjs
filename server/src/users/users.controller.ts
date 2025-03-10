import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Head,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { SignupLocalRequestDto } from "./dto/signup-local-request.dto";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  refs,
} from "@nestjs/swagger";
import { UserInfoDto } from "./dto/user-info.dto";
import { FollowUserDto } from "./dto/follow-user.dto";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { GetFollowingUsersQuery } from "./queries/get-following-users.query";
import { GetFollowingUsersHandler } from "./queries/handlers/get-following-users.handler";
import { FollowingUsersInfoDto } from "./dto/following-users-info.dto";
import { FollowerUsersInfoDto } from "./dto/follower-users-info.dto";
import { GetFollowerUsersQuery } from "./queries/get-follower-users.query";
import { GetFollowerUsersHandler } from "./queries/handlers/get-follower-users.handler";
import { GetUserInfoQuery } from "./queries/get-user-info.query";
import { GetUserInfoHandler } from "./queries/handlers/get-user-info.handler";
import { CheckFollowingQuery } from "./queries/check-following.query";
import { LoginUser } from "../common/decorator/login-user.decorator";
import { User } from "../entities/user.entity";
import { MyUserInfoDto } from "./dto/my-user-info.dto";
import { ChangeProfileRequestDto } from "./dto/change-profile-request.dto";
import { ChangeProfileCommand } from "./commands/change-profile.command";
import { ChangeProfileHandler } from "./commands/handlers/change-profile.handler";
import { ChangePasswordRequestDto } from "./dto/change-password-request.dto";
import { ChangePasswordCommand } from "./commands/change-password.command";
import { ChangePasswordHandler } from "./commands/handlers/change-password.handler";
import { DeleteAccountCommand } from "./commands/delete-account.command";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { GetMyUserInfoQuery } from "./queries/get-my-user-info.query";
import { GetMyUserInfoHandler } from "./queries/handlers/get-my-user-info.handler";
import { NicknameParamDto } from "./dto/param/nickname-param.dto";
import { GetWritingPostsQuery } from "./queries/get-writing-posts.query";
import { WritingPostsInfoDto } from "./dto/writing-posts-info.dto";
import { GetWritingCommentsQuery } from "./queries/get-writing-comments.query";
import { NicknameAndBoardTypeParamDto } from "./dto/param/nickname-and-board-type-param.dto";
import { WritingCommentsInfoDto } from "./dto/writing-comments-info.dto";
import { CursorPagingQueryDto } from "../common/dto/query/cursor-paging-query.dto";
import { ParamNicknameSameUserGuard } from "../auth/guard/authorization/param-nickname-same-user.guard";
import { GetScrapPostsQuery } from "./queries/get-scrap-posts.query";
import { PostListDto } from "../posts/dto/post-list.dto";
import { GetScrapPostsHandler } from "./queries/handlers/get-scrap-posts.handler";
import { GetLikePostsQuery } from "./queries/get-like-posts.query";
import { GetLikePostsHandler } from "./queries/handlers/get-like-posts.handler";
import { ProfileAvatarUploadInterceptor } from "../upload/interceptors/profile-avatar-upload.interceptor";
import { DeleteAvatarCommand } from "./commands/delete-avatar.command";
import { GetPostsOfFollowingsQuery } from "../posts/query/get-posts-of-followings.query";
import { PostListWithCursorDto } from "../posts/dto/post-list-with-cursor.dto";
import { SignupLocalCommand } from "./commands/signup-local.command";
import { CheckExistenceQuery } from "./queries/check-existence.query";
import { FollowUserCommand } from "./commands/follow-user.command";
import { UnfollowUserCommand } from "./commands/unfollow-user.command";
import { SignupLocalHandler } from "./commands/handlers/signup-local.handler";
import { KodingConfig } from "../config/configutation";

@ApiTags("USER")
@ApiUnauthorizedResponse({
  description: "인증 실패",
})
@ApiForbiddenResponse({
  description: "권한 없음",
})
@Controller("api/users")
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly configService: ConfigService<KodingConfig, true>,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @ApiOperation({ summary: "회원가입" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: SignupLocalRequestDto })
  @ApiCreatedResponse({
    description: "회원가입 성공, 확인 이메일 발송",
    type: MyUserInfoDto,
  })
  @ApiConflictResponse({ description: "회원가입 실패. 중복 있음" })
  @ApiBadRequestResponse({ description: "입력값 오류" })
  @UseInterceptors(ProfileAvatarUploadInterceptor)
  @Post()
  async joinUser(
    @Body() body: SignupLocalRequestDto,
    @UploadedFile() avatarFile?: Express.MulterS3.File,
  ) {
    console.log(`signup local request: ${JSON.stringify(body)}`);
    console.log("avatar : ", avatarFile);
    body.avatarUrl = avatarFile?.location;
    const user = (await this.commandBus.execute(
      new SignupLocalCommand(body),
    )) as Awaited<ReturnType<SignupLocalHandler["execute"]>>;
    return MyUserInfoDto.fromModel(user);
  }

  @ApiOperation({
    summary: "사용자 정보 조회",
  })
  @ApiNotFoundResponse({
    description: "없는 사용자",
  })
  @ApiOkResponse({
    description: "사용자 정보 조회 성공",
    schema: {
      oneOf: refs(UserInfoDto, MyUserInfoDto),
    },
  })
  @HttpCode(HttpStatus.OK)
  @Get(":nickname")
  getUserInfo(
    @Param() { nickname }: NicknameParamDto,
    @LoginUser() loginUser?: User,
  ) {
    if (loginUser?.nickname === nickname)
      return this.queryBus.execute(
        new GetMyUserInfoQuery(loginUser.nickname),
      ) as ReturnType<GetMyUserInfoHandler["execute"]>;
    else
      return this.queryBus.execute(
        new GetUserInfoQuery(nickname),
      ) as ReturnType<GetUserInfoHandler["execute"]>;
  }

  @ApiOperation({
    summary: "사용자 탈퇴 & 로그아웃",
  })
  @ApiNotFoundResponse({
    description: "없는 사용자",
  })
  @ApiNoContentResponse({
    description: "사용자 삭제 성공 & 로그아웃 완료",
  })
  @UseGuards(ParamNicknameSameUserGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":nickname")
  async deleteAccount(
    @Param() { nickname }: NicknameParamDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.commandBus.execute(new DeleteAccountCommand(nickname));
    req.logout();
    res.clearCookie(
      this.configService.get("session.cookie-name", { infer: true }),
    );
    return;
  }

  @ApiOperation({
    summary: "사용자 프로필 정보 변경",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    type: ChangeProfileRequestDto,
  })
  @ApiNotFoundResponse({
    description: "없는 사용자",
  })
  @ApiBadRequestResponse({
    description: "API Body 형식이 잘못되었거나, 확인 비밀번호가 다름",
  })
  @ApiOkResponse({
    description: "사용자 프로필 정보 변경 성공",
    type: MyUserInfoDto,
  })
  @UseGuards(ParamNicknameSameUserGuard)
  @UseInterceptors(ProfileAvatarUploadInterceptor)
  @HttpCode(HttpStatus.OK)
  @Patch(":nickname")
  async changeProfile(
    @Param() { nickname }: NicknameParamDto,
    @Body() body: ChangeProfileRequestDto,
    @UploadedFile() avatarFile?: Express.MulterS3.File,
  ) {
    body.avatarUrl = avatarFile?.location;
    this.logger.log(`사용자 프로필 변경; body: ${JSON.stringify(body)}`);
    const result = (await this.commandBus.execute(
      new ChangeProfileCommand(nickname, body),
    )) as Awaited<ReturnType<ChangeProfileHandler["execute"]>>;
    return MyUserInfoDto.fromModel(result);
  }

  @ApiOperation({
    summary: "사용자 비밀번호 변경",
  })
  @ApiBody({
    type: ChangePasswordRequestDto,
  })
  @ApiNotFoundResponse({
    description: "없는 사용자",
  })
  @ApiBadRequestResponse({
    description: "API Body 형식이 잘못되었거나, 확인 비밀번호가 다름",
  })
  @ApiNoContentResponse({
    description: "사용자 비밀번호 변경 성공",
  })
  @UseGuards(ParamNicknameSameUserGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch(":nickname/password")
  changePassword(
    @Param() { nickname }: NicknameParamDto,
    @Body() body: ChangePasswordRequestDto,
  ) {
    const { currentPassword, newPassword } = body;
    return this.commandBus.execute(
      new ChangePasswordCommand(nickname, currentPassword, newPassword),
    ) as ReturnType<ChangePasswordHandler["execute"]>;
  }

  @ApiQuery({
    name: "key",
    required: true,
    description: "중복 확인하고 싶은 속성 키",
    enum: ["email", "nickname"],
  })
  @ApiQuery({
    name: "value",
    required: true,
    description: "중복 확인하고 싶은 속성 값",
    example: "test@test.com",
    type: String,
  })
  @ApiOperation({ summary: "중복 확인" })
  @ApiNoContentResponse({
    description: "중복 없음",
  })
  @ApiConflictResponse({
    description: "중복 있음",
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Head()
  async checkConflictUser(
    @Query("key") key: string,
    @Query("value") value: string,
  ) {
    if (!["nickname", "email"].includes(key))
      throw new BadRequestException(
        `key 값은 ["nickname", "email"] 중 하나여아 합니다. ${key}`,
      );
    if (
      await this.queryBus.execute(
        new CheckExistenceQuery(key as "nickname" | "email", value),
      )
    )
      throw new ConflictException();
  }

  @ApiOperation({
    summary: "사용자 팔로우",
  })
  @ApiParam({
    name: "nickname",
    description: "팔로우를 요청한 사용자 닉네임",
  })
  @ApiBody({
    type: FollowUserDto,
  })
  @ApiNotFoundResponse({
    description: "잘못된 닉네임",
  })
  @ApiNoContentResponse({
    description: "팔로우 완료(원래 이미 팔로우하고 있었던 경우도 포함)",
  })
  @UseGuards(ParamNicknameSameUserGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(":nickname/followings")
  async followUser(
    @Param() { nickname }: NicknameParamDto,
    @Body() body: FollowUserDto,
  ) {
    await this.commandBus.execute(
      new FollowUserCommand(nickname, body.nickname),
    );
    return;
  }

  @ApiOperation({
    summary: "사용자 언팔로우",
  })
  @ApiParam({
    name: "nickname",
    description: "언팔로우를 요청한 사용자 닉네임",
  })
  @ApiParam({
    name: "followNickname",
    description: "언팔로우 할 사용자 닉네임",
  })
  @ApiNotFoundResponse({
    description: "잘못된 닉네임",
  })
  @ApiNoContentResponse({
    description: "언팔로우 완료(원래 팔로우하지 않았던 경우도 포함)",
  })
  @UseGuards(ParamNicknameSameUserGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":nickname/followings/:followNickname")
  async unfollowUser(
    @Param("nickname") nickname: string,
    @Param("followNickname") followNickname: string,
  ) {
    await this.commandBus.execute(
      new UnfollowUserCommand(nickname, followNickname),
    );
    return;
  }

  @ApiOperation({
    summary: "사용자 팔로우 여부 조회",
  })
  @ApiParam({
    name: "nickname",
    description: "팔로우를 하는지 확인할 사용자 닉네임",
  })
  @ApiParam({
    name: "followNickname",
    description: "팔로우를 당하는지 확인할 사용자 닉네임",
  })
  @ApiNotFoundResponse({
    description: "팔로우하지 않고 있거나 잘못된 닉네임",
  })
  @ApiNoContentResponse({
    description: "팔로우 중",
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Head(":nickname/followings/:followNickname")
  checkFollowing(
    @Param("nickname") nickname: string,
    @Param("followNickname") followNickname: string,
  ) {
    return this.queryBus.execute(
      new CheckFollowingQuery(nickname, followNickname),
    );
  }

  @ApiOperation({
    summary: "유저가 팔로잉하는 유저들 정보",
  })
  @ApiNotFoundResponse({
    description: "없는 사용자 닉네임",
  })
  @ApiOkResponse({
    description: "팔로잉하는 유저들 정보 조회 완료",
    type: FollowingUsersInfoDto,
  })
  @HttpCode(HttpStatus.OK)
  @Get(":nickname/followings")
  getFollowings(@Param() { nickname }: NicknameParamDto) {
    return this.queryBus.execute(
      new GetFollowingUsersQuery(nickname),
    ) as ReturnType<GetFollowingUsersHandler["execute"]>;
  }

  @ApiOperation({
    summary: "팔로잉 하는 유저의 게시글 모아보기",
  })
  @ApiOkResponse({
    description: "조회 성고",
    type: PostListWithCursorDto,
  })
  @UseGuards(ParamNicknameSameUserGuard)
  @HttpCode(HttpStatus.OK)
  @Get(":nickname/followings/posts")
  getPostsOfFollowings(
    @Param() { nickname }: NicknameParamDto,
    @Query() { pageSize, cursor }: CursorPagingQueryDto,
  ) {
    return this.queryBus.execute(
      new GetPostsOfFollowingsQuery(nickname, pageSize, cursor),
    );
  }

  @ApiOperation({
    summary: "유저를 팔로우하는 유저들 정보",
  })
  @ApiNotFoundResponse({
    description: "없는 사용자 닉네임",
  })
  @ApiOkResponse({
    description: "팔로우하는 유저들 정보 조회 완료",
    type: FollowerUsersInfoDto,
  })
  @HttpCode(HttpStatus.OK)
  @Get(":nickname/followers")
  getFollowers(@Param() { nickname }: NicknameParamDto) {
    return this.queryBus.execute(
      new GetFollowerUsersQuery(nickname),
    ) as ReturnType<GetFollowerUsersHandler["execute"]>;
  }

  /*
   * 사용자가 작성한 게시글 조회
   */
  @ApiOkResponse({
    description: "조회 성공",
    type: WritingPostsInfoDto,
  })
  @HttpCode(HttpStatus.OK)
  @Get(":nickname/posts/:boardType")
  getAllPosts(
    @Param() { nickname, boardType }: NicknameAndBoardTypeParamDto,
    @Query() { cursor, pageSize }: CursorPagingQueryDto,
  ) {
    return this.queryBus.execute(
      new GetWritingPostsQuery(nickname, boardType, pageSize, cursor),
    );
  }

  /*
   * 사용자가 작성한 댓글 조회
   */
  @ApiOkResponse({
    description: "조회 성공",
    type: WritingCommentsInfoDto,
  })
  @HttpCode(HttpStatus.OK)
  @Get(":nickname/comments/:boardType")
  getAllComments(
    @Param() { nickname, boardType }: NicknameAndBoardTypeParamDto,
    @Query() { cursor, pageSize }: CursorPagingQueryDto,
  ) {
    return this.queryBus.execute(
      new GetWritingCommentsQuery(nickname, boardType, pageSize, cursor),
    );
  }

  /*
   * 스크랩한 게시글들 조회
   */
  @ApiOkResponse({
    description: "스크랩한 게시글들 조회 성공",
    type: PostListDto,
  })
  @HttpCode(HttpStatus.OK)
  @Get(":nickname/scrap-posts")
  getScrapPosts(@Param() { nickname }: NicknameParamDto) {
    return this.queryBus.execute(
      new GetScrapPostsQuery(nickname),
    ) as ReturnType<GetScrapPostsHandler["execute"]>;
  }

  /*
   * 좋아요한 게시글들 조회
   */
  @ApiOkResponse({
    description: "좋아요한 게시글들 조회 성공",
    type: PostListDto,
  })
  @HttpCode(HttpStatus.OK)
  @Get(":nickname/like-posts")
  getLikePosts(@Param() { nickname }: NicknameParamDto) {
    return this.queryBus.execute(new GetLikePostsQuery(nickname)) as ReturnType<
      GetLikePostsHandler["execute"]
    >;
  }

  /*
   * 프로필 사진 삭제
   */
  @ApiNoContentResponse({ description: "프로필 사진 삭제 성공" })
  @UseGuards(ParamNicknameSameUserGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":nickname/avatarUrl")
  async removeAvatar(@Param() { nickname }: NicknameParamDto) {
    await this.commandBus.execute(new DeleteAvatarCommand(nickname));
    return;
  }
}
