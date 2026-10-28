import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Register a standard user account" })
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Post("login")
  @ApiOperation({ summary: "Authenticate with email and password" })
  login(@Body() dto: LoginDto) { return this.auth.login(dto); }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Return the currently authenticated user" })
  me(@CurrentUser() user: AuthenticatedUser) { return user; }
}
