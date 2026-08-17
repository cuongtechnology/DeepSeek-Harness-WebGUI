import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword, isEmail, isNonEmptyString, type PublicUser } from '@deepseek-harness/shared';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async register(email: string, password: string, name: string): Promise<PublicUser> {
    if (process.env.AUTH_ALLOW_REGISTRATION === 'false') {
      throw new ConflictException('Registration is disabled');
    }
    if (!isEmail(email) || !isNonEmptyString(password, 128) || !isNonEmptyString(name, 80)) {
      throw new UnauthorizedException('Invalid registration details');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const userCount = await this.prisma.user.count();
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        name,
        role: userCount === 0 ? 'admin' : 'user',
      },
    });

    await this.audit.log({ userId: user.id, action: 'auth.register', resourceType: 'user', resourceId: user.id });
    return this.toPublic(user);
  }

  async login(email: string, password: string): Promise<{ user: PublicUser; token: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      await this.audit.log({ action: 'auth.login_failed', metadata: { email } });
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    await this.audit.log({ userId: user.id, action: 'auth.login' });
    return { user: this.toPublic(user), token };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    return this.toPublic(user);
  }

  private toPublic(user: { id: string; email: string; name: string; createdAt: Date }): PublicUser {
    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString() };
  }
}
