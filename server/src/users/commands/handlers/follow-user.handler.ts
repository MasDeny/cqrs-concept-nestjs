import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs";
import { FollowUserCommand } from "../follow-user.command";
import { UsersRepository } from "../../users.repository";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { User } from "../../../models/user.model";
import { UserFollowedEvent } from "../../events/user-followed.event";

@CommandHandler(FollowUserCommand)
export class FollowUserHandler implements ICommandHandler<FollowUserCommand> {
  constructor(
    private readonly userRepository: UsersRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: FollowUserCommand): Promise<{ from: User; to: User }> {
    const { fromNickname, toNickname } = command;
    if (fromNickname === toNickname)
      throw new BadRequestException("자신은 팔로우할 수 없습니다");
    const users = await this.userRepository.findAll({
      nickname: { in: [fromNickname, toNickname] },
    });
    if (users.length !== 2)
      throw new NotFoundException("잘못된 사용자 정보입니다");
    const fromUser = users.find((user) => user.nickname === fromNickname);
    const toUser = users.find((user) => user.nickname === toNickname);
    const alreadyFollowed = fromUser.followingNicknames.some(
      (nickname) => nickname === toNickname,
    );
    const { from, to } = await this.userRepository.followUser(fromUser, toUser);
    if (!alreadyFollowed)
      this.eventBus.publish(new UserFollowedEvent(fromNickname, toNickname));
    return { from, to };
  }
}
