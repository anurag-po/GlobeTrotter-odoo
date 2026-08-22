import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryRepositories } from '../../src/infrastructure/db/repositories/index.js';
import { MemoryStore } from '../../src/infrastructure/db/memory-store.js';
import { makeRegisterUserUseCase } from '../../src/application/auth/register-user.js';
import { makeLoginUserUseCase } from '../../src/application/auth/login-user.js';
import { makeRefreshTokenUseCase } from '../../src/application/auth/refresh-token.js';
import { makeForgotPasswordUseCase } from '../../src/application/auth/forgot-password.js';
import { makeResetPasswordUseCase } from '../../src/application/auth/reset-password.js';

describe('Auth Use Cases Unit Tests', () => {
  let store: MemoryStore;
  let repos: ReturnType<typeof createMemoryRepositories>;

  beforeEach(() => {
    store = new MemoryStore();
    repos = createMemoryRepositories(store);
  });

  it('should register a new user with manual email signup', async () => {
    const registerUser = makeRegisterUserUseCase({
      userRepo: repos.userRepo,
      authTokenRepo: repos.authTokenRepo,
    });

    const result = await registerUser({
      username: 'alice_explorer',
      email: 'alice@example.com',
      password: 'StrongPassword123',
      firstName: 'Alice',
      lastName: 'Smith',
    });

    expect(result.user.username).toBe('alice_explorer');
    expect(result.user.email).toBe('alice@example.com');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('should reject duplicate email and username registration', async () => {
    const registerUser = makeRegisterUserUseCase({
      userRepo: repos.userRepo,
      authTokenRepo: repos.authTokenRepo,
    });

    await registerUser({
      username: 'bob_traveler',
      email: 'bob@example.com',
      password: 'StrongPassword123',
      firstName: 'Bob',
      lastName: 'Jones',
    });

    await expect(
      registerUser({
        username: 'bob_other',
        email: 'bob@example.com',
        password: 'StrongPassword123',
        firstName: 'Bob',
        lastName: 'Jones',
      })
    ).rejects.toThrow(/Email is already registered/);

    await expect(
      registerUser({
        username: 'bob_traveler',
        email: 'bob_other@example.com',
        password: 'StrongPassword123',
        firstName: 'Bob',
        lastName: 'Jones',
      })
    ).rejects.toThrow(/Username is already taken/);
  });

  it('should authenticate user via email or username and lock out after 5 failures', async () => {
    const registerUser = makeRegisterUserUseCase({
      userRepo: repos.userRepo,
      authTokenRepo: repos.authTokenRepo,
    });
    const loginUser = makeLoginUserUseCase({
      userRepo: repos.userRepo,
      authTokenRepo: repos.authTokenRepo,
      auditLogRepo: repos.auditLogRepo,
    });

    await registerUser({
      username: 'charlie_voyager',
      email: 'charlie@example.com',
      password: 'StrongPassword123',
      firstName: 'Charlie',
      lastName: 'Brown',
    });

    // Login with username
    const res1 = await loginUser({ identifier: 'charlie_voyager', password: 'StrongPassword123' });
    expect(res1.user.email).toBe('charlie@example.com');

    // Login with email
    const res2 = await loginUser({ identifier: 'charlie@example.com', password: 'StrongPassword123' });
    expect(res2.user.username).toBe('charlie_voyager');

    // 5 failed password attempts
    for (let i = 0; i < 5; i++) {
      await expect(
        loginUser({ identifier: 'charlie@example.com', password: 'WrongPassword' })
      ).rejects.toThrow(/Invalid email\/username or password/);
    }

    // 6th attempt should return Account Locked (423)
    await expect(
      loginUser({ identifier: 'charlie@example.com', password: 'StrongPassword123' })
    ).rejects.toThrow(/Account is temporarily locked/);
  });

  it('should rotate refresh token on every refresh', async () => {
    const registerUser = makeRegisterUserUseCase({
      userRepo: repos.userRepo,
      authTokenRepo: repos.authTokenRepo,
    });
    const refreshToken = makeRefreshTokenUseCase({
      userRepo: repos.userRepo,
      authTokenRepo: repos.authTokenRepo,
    });

    const reg = await registerUser({
      username: 'david_nomad',
      email: 'david@example.com',
      password: 'StrongPassword123',
      firstName: 'David',
      lastName: 'Miller',
    });

    const ref1 = await refreshToken(reg.refreshToken);
    expect(ref1.accessToken).toBeDefined();
    expect(ref1.refreshToken).not.toBe(reg.refreshToken);

    // Old refresh token must now be invalid
    await expect(refreshToken(reg.refreshToken)).rejects.toThrow(/Invalid or expired refresh token/);

    // New refresh token should work
    const ref2 = await refreshToken(ref1.refreshToken);
    expect(ref2.accessToken).toBeDefined();
  });
});
