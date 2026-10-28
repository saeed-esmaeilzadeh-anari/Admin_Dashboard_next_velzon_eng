import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "Alex Johnson" })
  @IsString() @MinLength(2) @MaxLength(100)
  name!: string;

  @ApiProperty({ example: "alex@example.com" })
  @IsEmail() @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 12, writeOnly: true })
  @IsString() @MinLength(12) @MaxLength(72)
  password!: string;
}
