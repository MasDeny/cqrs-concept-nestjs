import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { SignupGithubCommand } from "../signup-github.command";
import { User } from "../../../models/user.model";
import { UsersRepository } from "../../users.repository";
import axios from "axios";
import {
  GithubRepositoryInfo,
  GithubUserInfo,
} from "../../../schemas/user.schema";
import { ForbiddenException, Logger } from "@nestjs/common";

@CommandHandler(SignupGithubCommand)
export class SignupGithubHandler
  implements ICommandHandler<SignupGithubCommand>
{
  private readonly logger = new Logger(SignupGithubHandler.name);

  constructor(private readonly userRepository: UsersRepository) {}

  async execute(command: SignupGithubCommand): Promise<User> {
    const {
      signupGithubRequest: {
        githubId,
        githubUserIdentifier,
        reposUrl,
        avatarUrl,
        email,
        name,
      },
    } = command;
    let user = await this.userRepository.findOne({
      githubUserIdentifier: { eq: githubUserIdentifier },
    });
    if (user) return user;

    const rawRepositories: any[] = (await axios.get(reposUrl)).data;

    const repositories = rawRepositories.map(
      ({ name, html_url: htmlUrl, description, stargazers_count: starCount }) =>
        ({ name, htmlUrl, description, starCount } as GithubRepositoryInfo),
    );

    const githubUserInfo = {
      githubId,
      email,
      name,
      avatarUrl,
      repositories,
    } as GithubUserInfo;

    user = await this.userRepository.findByEmail(email);
    if (user.accountDeletedSince)
      throw new ForbiddenException("계정이 삭제되었으므로 가입할 수 없습니다");
    this.logger.log(user);
    if (user) {
      user.linkAccountWithGithub(githubUserIdentifier, githubUserInfo);
      user = await this.userRepository.updateByEmail(user);
    } else {
      user = new User({
        email,
        githubUserInfo,
        githubUserIdentifier,
        isGithubUser: true,
      });
      user.setNewGithubSignupVerifyToken();
      user = await this.userRepository.persistByEmail(user);
    }
    console.log(user);
    return user;
  }
}
