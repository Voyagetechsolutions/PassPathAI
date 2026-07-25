import { IsEmail } from 'class-validator';

export class FriendRequestDto {
  @IsEmail()
  email!: string;
}
