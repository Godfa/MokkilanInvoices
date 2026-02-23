# 2FA Implementation Plan - MokkilanInvoices

**Document Version:** 1.0
**Date:** 2026-02-20
**Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Recommended Approach](#recommended-approach)
4. [Technical Specifications](#technical-specifications)
5. [Implementation Phases](#implementation-phases)
6. [Security Considerations](#security-considerations)
7. [Testing Strategy](#testing-strategy)
8. [Resources & References](#resources--references)

---

## Executive Summary

This document outlines the implementation plan for adding Two-Factor Authentication (2FA) to the MokkilanInvoices application. The recommended approach uses **TOTP (Time-based One-Time Password)** with authenticator apps, which provides the best balance of security, user experience, and cost-effectiveness.

**Key Benefits:**
- Enhanced security for user accounts
- Industry-standard TOTP implementation
- No recurring costs (vs. SMS-based 2FA)
- Offline support via authenticator apps
- Built-in ASP.NET Core Identity support

**Estimated Effort:** 18-24 hours total development time

---

## Current State Analysis

### Existing Authentication Infrastructure

**Technology Stack:**
- **Backend:** ASP.NET Core 8.0 with Identity Framework
- **Frontend:** React + TypeScript with MobX state management
- **Authentication:** JWT Bearer tokens (7-day expiration)
- **Database:** PostgreSQL with Entity Framework Core

**Current Security Features:**
✅ Password-based authentication
✅ Account lockout (5 failed attempts → 100-year lockout)
✅ Password reset via email tokens
✅ Forced password change on first login
✅ Role-based authorization
✅ JWT token-based session management

**2FA-Ready Infrastructure:**
✅ Database schema includes `TwoFactorEnabled` field in `AspNetUsers` table
✅ `UserManager<User>` has built-in 2FA methods
✅ Token providers configured via `AddDefaultTokenProviders()`
✅ Email service available for notifications
✅ Phone number field exists in User model

**Current Gaps:**
❌ No 2FA endpoints or controllers
❌ No TOTP secret generation/verification
❌ No QR code generation
❌ No 2FA UI components
❌ No recovery code system
❌ No 2FA enforcement policies

### Key Files & Architecture

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Identity Config | `API/Extensions/IdentityServiceExtensions.cs` | Identity & JWT setup |
| User Model | `Domain/User.cs` | User entity (extends IdentityUser) |
| Auth Controller | `API/Controllers/AccountController.cs` | Login/registration endpoints |
| Token Service | `API/Services/TokenService.cs` | JWT token generation |
| Email Service | `API/Services/EmailService.cs` | Email sending (for notifications) |
| Frontend API | `client-app/src/app/api/agent.ts` | Axios HTTP client |
| User Store | `client-app/src/app/stores/userStore.ts` | MobX authentication state |

---

## Recommended Approach

### Why TOTP (Time-based One-Time Password)?

**TOTP Advantages:**
- ✅ **Security:** More secure than SMS (resistant to SIM-swap attacks)
- ✅ **Offline:** Works without internet connection
- ✅ **Cost:** No SMS fees or third-party services required
- ✅ **Compatibility:** Works with Google Authenticator, Microsoft Authenticator, Authy, 1Password, etc.
- ✅ **Standards:** Industry standard (RFC 6238)
- ✅ **Built-in:** ASP.NET Core Identity has native TOTP support

**Alternatives Considered:**
- ❌ **SMS 2FA:** Vulnerable to SIM-swapping, requires SMS service costs
- ❌ **Email 2FA:** Less secure (email accounts often lack 2FA themselves)
- ⚠️ **WebAuthn/FIDO2:** More secure but requires hardware keys or biometrics (future enhancement)

---

## Technical Specifications

### Backend Components

#### 1. NuGet Packages Required

```bash
# QR code generation for TOTP setup
dotnet add API/API.csproj package QRCoder --version 1.4.3
```

#### 2. New DTOs (API/DTOs/)

**Enable2FADto.cs**
```csharp
public class Enable2FADto
{
    public string Secret { get; set; }              // TOTP secret key
    public string QrCodeDataUri { get; set; }       // Base64 QR code image
    public string FormattedKey { get; set; }        // Manual entry key (formatted)
}
```

**Verify2FADto.cs**
```csharp
public class Verify2FADto
{
    [Required]
    [StringLength(6, MinimumLength = 6)]
    public string Code { get; set; }                // 6-digit TOTP code
}
```

**TwoFactorLoginDto.cs**
```csharp
public class TwoFactorLoginDto
{
    [Required]
    public string Email { get; set; }

    [Required]
    [StringLength(6, MinimumLength = 6)]
    public string Code { get; set; }                // TOTP or recovery code

    public bool RememberMachine { get; set; }       // Optional: remember device
}
```

**Update UserDto**
```csharp
public class UserDto
{
    // ... existing fields
    public bool TwoFactorEnabled { get; set; }
    public int RecoveryCodesLeft { get; set; }      // Optional: show remaining codes
}
```

#### 3. TwoFactorService (API/Services/TwoFactorService.cs)

**Interface:**
```csharp
public interface ITwoFactorService
{
    Task<Enable2FADto> EnableTwoFactorAsync(User user);
    Task<bool> VerifyTotpCodeAsync(User user, string code);
    Task<string[]> GenerateRecoveryCodesAsync(User user);
    Task<bool> VerifyRecoveryCodeAsync(User user, string code);
    string GenerateQrCodeDataUri(string email, string secret);
}
```

**Key Methods:**
- `EnableTwoFactorAsync()`: Generates TOTP secret and QR code
- `VerifyTotpCodeAsync()`: Validates 6-digit TOTP code
- `GenerateRecoveryCodesAsync()`: Creates 10 single-use backup codes
- `VerifyRecoveryCodeAsync()`: Validates and consumes recovery code
- `GenerateQrCodeDataUri()`: Returns QR code as Base64 data URI

#### 4. AccountController Endpoints

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| POST | `/api/account/2fa/enable` | ✅ Yes | Start 2FA setup (returns QR code) |
| POST | `/api/account/2fa/verify` | ✅ Yes | Confirm 2FA activation with code |
| POST | `/api/account/2fa/disable` | ✅ Yes | Disable 2FA (requires password) |
| GET | `/api/account/2fa/recovery-codes` | ✅ Yes | Get new recovery codes |
| POST | `/api/account/login` | ❌ No | **Modified:** Returns `requiresTwoFactor` if 2FA enabled |
| POST | `/api/account/login/2fa` | ❌ No | **New:** Complete login with TOTP code |

**Modified Login Flow:**
```csharp
[HttpPost("login")]
public async Task<ActionResult<UserDto>> Login(LoginDto loginDto)
{
    var user = await _userManager.FindByEmailAsync(loginDto.Email);
    if (user == null) return Unauthorized();

    var result = await _signInManager.CheckPasswordSignInAsync(user, loginDto.Password, true);
    if (!result.Succeeded) return Unauthorized();

    // NEW: Check if 2FA is enabled
    if (await _userManager.GetTwoFactorEnabledAsync(user))
    {
        return Ok(new { requiresTwoFactor = true, email = user.Email });
    }

    // Return JWT token for non-2FA users
    return CreateUserDto(user);
}

[HttpPost("login/2fa")]
public async Task<ActionResult<UserDto>> LoginWith2FA(TwoFactorLoginDto dto)
{
    var user = await _userManager.FindByEmailAsync(dto.Email);
    if (user == null) return Unauthorized();

    // Verify TOTP code or recovery code
    bool isValid = await _twoFactorService.VerifyTotpCodeAsync(user, dto.Code) ||
                   await _twoFactorService.VerifyRecoveryCodeAsync(user, dto.Code);

    if (!isValid) return Unauthorized("Invalid authentication code");

    // Optional: Remember this device for 30 days
    if (dto.RememberMachine)
    {
        await _signInManager.RememberTwoFactorClientAsync(user);
    }

    return CreateUserDto(user);
}
```

### Frontend Components

#### 1. TypeScript Models (client-app/src/app/models/)

**twoFactor.ts**
```typescript
export interface TwoFactorSetup {
    secret: string;
    qrCodeDataUri: string;
    formattedKey: string;
}

export interface TwoFactorLoginRequest {
    email: string;
    code: string;
    rememberMachine: boolean;
}
```

**Update user.ts**
```typescript
export interface User {
    // ... existing fields
    twoFactorEnabled: boolean;
    recoveryCodesLeft?: number;
}
```

#### 2. API Agent Extensions (client-app/src/app/api/agent.ts)

```typescript
const TwoFactor = {
    enable: () => requests.post<TwoFactorSetup>('/account/2fa/enable', {}),
    verify: (code: string) => requests.post('/account/2fa/verify', { code }),
    disable: (password: string) => requests.post('/account/2fa/disable', { password }),
    getRecoveryCodes: () => requests.get<string[]>('/account/2fa/recovery-codes'),
    loginWith2FA: (data: TwoFactorLoginRequest) =>
        requests.post<User>('/account/login/2fa', data)
};

export default {
    Account: { /* ... existing methods */ },
    TwoFactor,
    // ... other modules
};
```

#### 3. React Components (client-app/src/features/)

**profile/TwoFactorSettings.tsx**
- Toggle to enable/disable 2FA
- Shows current 2FA status
- Button to view recovery codes
- Opens TwoFactorSetupModal when enabling

**profile/TwoFactorSetupModal.tsx**
- Displays QR code for scanning
- Shows manual entry key as fallback
- Input field for verification code
- Instructions for setup
- Downloads recovery codes after verification

**profile/RecoveryCodesModal.tsx**
- Displays 10 recovery codes
- Copy to clipboard functionality
- Download as text file
- Warning about safekeeping

**account/TwoFactorLoginForm.tsx**
- 6-digit code input field
- "Remember this device" checkbox
- Option to use recovery code instead
- Clear error messages

**Modified: account/LoginForm.tsx**
- Detect `requiresTwoFactor: true` response
- Switch to TwoFactorLoginForm when needed
- Pass email to 2FA form

---

## Implementation Phases

### Phase 1: Backend Foundation (6-8 hours)

**1.1. Install Dependencies**
```bash
cd API
dotnet add package QRCoder
```

**1.2. Create TwoFactorService**
- [ ] Create `ITwoFactorService` interface
- [ ] Implement `TwoFactorService` class
- [ ] Add TOTP secret generation using `UserManager.GenerateTwoFactorTokenAsync()`
- [ ] Implement QR code generation with QRCoder library
- [ ] Add recovery code generation (10 codes, 8 characters each)
- [ ] Register service in DI container (`ApplicationServiceExtensions.cs`)

**1.3. Create DTOs**
- [ ] `Enable2FADto.cs`
- [ ] `Verify2FADto.cs`
- [ ] `TwoFactorLoginDto.cs`
- [ ] Update `UserDto.cs` with 2FA fields

**1.4. Update AccountController**
- [ ] Add `POST /api/account/2fa/enable` endpoint
- [ ] Add `POST /api/account/2fa/verify` endpoint
- [ ] Add `POST /api/account/2fa/disable` endpoint
- [ ] Add `GET /api/account/2fa/recovery-codes` endpoint
- [ ] Modify `POST /api/account/login` to detect 2FA
- [ ] Add `POST /api/account/login/2fa` endpoint

**1.5. Database Migration (if needed)**
- [ ] Check if `TwoFactorEnabled` field exists in User table (should already exist)
- [ ] No migration needed - ASP.NET Core Identity handles this

### Phase 2: Frontend UI (6-8 hours)

**2.1. Create TypeScript Models**
- [ ] Create `twoFactor.ts` with interfaces
- [ ] Update `user.ts` with 2FA fields

**2.2. Update API Agent**
- [ ] Add `TwoFactor` module to agent.ts
- [ ] Add all 2FA endpoints

**2.3. Create 2FA Components**
- [ ] `TwoFactorSettings.tsx` - Settings page integration
- [ ] `TwoFactorSetupModal.tsx` - QR code and verification
- [ ] `RecoveryCodesModal.tsx` - Display recovery codes
- [ ] `TwoFactorLoginForm.tsx` - Login with 2FA code

**2.4. Integrate with Existing Pages**
- [ ] Add 2FA section to Profile page
- [ ] Modify LoginForm to handle 2FA flow
- [ ] Update user store to track 2FA status

**2.5. Styling**
- [ ] Use Semantic UI React components (consistent with app)
- [ ] Add loading states
- [ ] Add error handling and validation feedback

### Phase 3: Security Features (3-4 hours)

**3.1. Recovery Codes System**
- [ ] Generate 10 unique codes per user
- [ ] Hash codes before storing in database
- [ ] Mark codes as used when redeemed
- [ ] Show remaining code count to user
- [ ] Allow regeneration (invalidates old codes)

**3.2. Rate Limiting (Backend)**
- [ ] Limit 2FA login attempts (5 per 5 minutes)
- [ ] Track failed attempts per user
- [ ] Temporary lockout after threshold

**3.3. "Remember This Device" (Optional)**
- [ ] Use `SignInManager.RememberTwoFactorClientAsync()`
- [ ] Set cookie to bypass 2FA for 30 days
- [ ] Allow users to manage remembered devices

**3.4. Audit Logging**
- [ ] Log 2FA enable/disable events
- [ ] Log failed 2FA attempts
- [ ] Log recovery code usage
- [ ] Add to existing logging infrastructure

**3.5. Email Notifications**
- [ ] Send email when 2FA is enabled
- [ ] Send email when 2FA is disabled
- [ ] Alert on recovery code usage
- [ ] Use existing EmailService

### Phase 4: Testing & Documentation (3-4 hours)

**4.1. Backend Tests (xUnit)**
- [ ] Test TOTP code generation and validation
- [ ] Test recovery code generation and redemption
- [ ] Test login flow with 2FA enabled
- [ ] Test 2FA enable/disable endpoints
- [ ] Test rate limiting

**4.2. Frontend Tests (Vitest)**
- [ ] Test TwoFactorSetupModal rendering
- [ ] Test code input validation
- [ ] Test login flow with 2FA
- [ ] Test error handling

**4.3. Integration Testing**
- [ ] Manual testing with Google Authenticator
- [ ] Test time synchronization scenarios
- [ ] Test recovery code redemption
- [ ] Test "remember device" functionality

**4.4. Documentation**
- [ ] Update README with 2FA setup instructions
- [ ] User guide: How to enable 2FA
- [ ] User guide: How to use recovery codes
- [ ] Developer guide: 2FA architecture

---

## Security Considerations

### Critical Security Requirements

#### 1. Time Synchronization ⏰
**Issue:** TOTP depends on accurate server time (±30 second window)
**Solution:**
- Ensure server NTP synchronization
- Use `DateTime.UtcNow` (never local time)
- Consider ±1 time step tolerance (30 seconds before/after)

**Implementation:**
```csharp
// In TwoFactorService
var validationWindow = new VerificationWindow(
    previous: 1,  // Allow 1 step before (30s)
    future: 1     // Allow 1 step after (30s)
);
```

#### 2. Secret Storage 🔐
**Issue:** TOTP secrets must be encrypted at rest
**Solution:**
- ASP.NET Core Identity automatically encrypts `AuthenticatorKey`
- Stored in `AspNetUserTokens` table with Data Protection API
- Never expose secrets in logs or error messages

#### 3. Recovery Code Security 🔑
**Issue:** Recovery codes are as powerful as passwords
**Solution:**
- Hash recovery codes before storing (use `PasswordHasher<User>`)
- Mark as single-use (delete or flag after use)
- Limit count (10 codes maximum)
- Force regeneration after use

**Implementation:**
```csharp
// Generate and hash recovery codes
var codes = new List<string>();
for (int i = 0; i < 10; i++)
{
    var code = GenerateRandomCode(8); // 8 characters
    codes.Add(code);

    // Hash before storing
    var hashedCode = _passwordHasher.HashPassword(user, code);
    await SaveRecoveryCode(user, hashedCode);
}
return codes.ToArray(); // Return plain codes only once
```

#### 4. HTTPS Requirement 🔒
**Issue:** JWT tokens and TOTP secrets travel over network
**Current State:** `app.UseHttpsRedirection()` is commented out
**Solution:**
- **CRITICAL:** Uncomment HTTPS redirection in `Startup.cs`
- Enforce HTTPS in production
- Use HSTS headers

#### 5. Rate Limiting 🚦
**Issue:** Brute-force attacks on 6-digit codes (1,000,000 combinations)
**Solution:**
- Limit to 5 attempts per 5 minutes per user
- Exponential backoff after failed attempts
- Temporary account lockout after threshold

**Implementation:**
```csharp
// Track failed 2FA attempts
if (failedAttempts >= 5)
{
    await _userManager.SetLockoutEndDateAsync(user, DateTimeOffset.UtcNow.AddMinutes(5));
    return Unauthorized("Too many failed attempts. Try again in 5 minutes.");
}
```

#### 6. Backup Strategy 💾
**Issue:** Users lose access if they lose their phone
**Solution:**
- **ALWAYS** provide recovery codes
- Force download during 2FA setup
- Show warning about safekeeping
- Allow regeneration (requires password verification)

#### 7. Session Security 🎫
**Issue:** Stolen JWT token bypasses 2FA
**Current State:** 7-day token expiration
**Recommendations:**
- Consider shorter token expiration (24 hours)
- Implement refresh tokens
- Invalidate tokens on 2FA disable
- Add `SecurityStamp` check (already in User model)

---

## Testing Strategy

### Manual Testing Checklist

#### 2FA Setup Flow
- [ ] Enable 2FA from profile page
- [ ] QR code displays correctly
- [ ] Manual entry key is formatted (XXXX-XXXX-XXXX-XXXX)
- [ ] Scan QR code with Google Authenticator
- [ ] Enter 6-digit code to verify
- [ ] Receive 10 recovery codes
- [ ] Download recovery codes as file
- [ ] Email notification sent

#### Login Flow
- [ ] Login with email/password (2FA enabled user)
- [ ] Redirected to 2FA code entry
- [ ] Enter valid TOTP code → successful login
- [ ] Enter invalid code → error message
- [ ] Enter recovery code → successful login (code consumed)
- [ ] Check "Remember this device" → bypass 2FA for 30 days
- [ ] Rate limiting triggers after 5 failed attempts

#### 2FA Disable Flow
- [ ] Navigate to profile settings
- [ ] Click "Disable 2FA"
- [ ] Enter password for confirmation
- [ ] Enter current TOTP code
- [ ] 2FA disabled successfully
- [ ] Email notification sent

#### Recovery Codes
- [ ] View remaining recovery codes count
- [ ] Use recovery code to login
- [ ] Code is marked as used (can't reuse)
- [ ] Regenerate recovery codes (requires password)
- [ ] Old codes invalidated after regeneration

#### Error Handling
- [ ] Server time drift (test with ±2 minutes)
- [ ] Invalid code format (non-numeric, wrong length)
- [ ] Network errors display user-friendly messages
- [ ] QR code generation failure fallback

### Automated Testing

#### Backend Unit Tests
```csharp
[Fact]
public async Task VerifyTotpCode_ValidCode_ReturnsTrue()
{
    // Arrange
    var user = CreateTestUser();
    var secret = await _twoFactorService.EnableTwoFactorAsync(user);
    var code = GenerateValidTotpCode(secret.Secret);

    // Act
    var result = await _twoFactorService.VerifyTotpCodeAsync(user, code);

    // Assert
    Assert.True(result);
}

[Fact]
public async Task LoginWith2FA_ExceedsRateLimit_ReturnsLockedOut()
{
    // Test rate limiting implementation
}
```

#### Frontend Component Tests
```typescript
describe('TwoFactorSetupModal', () => {
    it('renders QR code when opened', () => {
        // Test component rendering
    });

    it('validates 6-digit code input', () => {
        // Test input validation
    });

    it('shows recovery codes after successful verification', () => {
        // Test success flow
    });
});
```

---

## Resources & References

### Official Documentation
- [Multi-factor authentication in ASP.NET Core | Microsoft Learn](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/mfa?view=aspnetcore-10.0)
- [Enable QR code generation for TOTP authenticator apps](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity-enable-qrcodes?view=aspnetcore-8.0)
- [ASP.NET Core Identity](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity)

### Implementation Guides
- [Implementing TOTP (Time-Based One-Time Password) MFA in .NET Core](https://www.c-sharpcorner.com/article/implementing-totp-time-based-one-time-password-mfa-in-net-core/)
- [How to set up two factor authentication in ASP.NET Core using Google Authenticator](https://medium.com/free-code-camp/how-to-set-up-two-factor-authentication-on-asp-net-core-using-google-authenticator-4b15d0698ec9)
- [How to Add Secure TOTP + WebAuthn 2FA to Your .NET 8 API](https://medium.com/c-sharp-programming/how-to-add-secure-totp-webauthn-2fa-to-your-net-8-api-step-by-step-guide-with-full-code-9ed316afa11a)

### Libraries
- **QRCoder** - [NuGet Package](https://www.nuget.org/packages/QRCoder/) | [GitHub](https://github.com/codebude/QRCoder)
  - MIT License
  - Pure C# QR code generator
  - No external dependencies

- **Otp.NET** (Alternative) - [GitHub](https://github.com/kspearrin/Otp.NET)
  - MIT License
  - TOTP and HOTP implementation
  - Use if ASP.NET Core Identity TOTP is insufficient

### Standards & RFCs
- [RFC 6238 - TOTP: Time-Based One-Time Password Algorithm](https://datatracker.ietf.org/doc/html/rfc6238)
- [RFC 4226 - HOTP: An HMAC-Based One-Time Password Algorithm](https://datatracker.ietf.org/doc/html/rfc4226)

### Authenticator Apps
Users can choose any TOTP-compatible app:
- Google Authenticator (iOS, Android)
- Microsoft Authenticator (iOS, Android)
- Authy (iOS, Android, Desktop)
- 1Password (Cross-platform)
- Bitwarden (Cross-platform)

---

## Appendix: Code Snippets

### QR Code Generation Example

```csharp
public string GenerateQrCodeDataUri(string email, string secret)
{
    // otpauth URI format for authenticator apps
    var uri = $"otpauth://totp/MokkilanInvoices:{email}?secret={secret}&issuer=MokkilanInvoices";

    using var qrGenerator = new QRCodeGenerator();
    var qrCodeData = qrGenerator.CreateQrCode(uri, QRCodeGenerator.ECCLevel.Q);

    using var qrCode = new PngByteQRCode(qrCodeData);
    var qrCodeImage = qrCode.GetGraphic(20);

    // Return as Base64 data URI for direct embedding in <img> tag
    return $"data:image/png;base64,{Convert.ToBase64String(qrCodeImage)}";
}
```

### TOTP Verification with Time Window

```csharp
public async Task<bool> VerifyTotpCodeAsync(User user, string code)
{
    // UserManager.VerifyTwoFactorTokenAsync uses default time window
    return await _userManager.VerifyTwoFactorTokenAsync(
        user,
        _userManager.Options.Tokens.AuthenticatorTokenProvider,
        code
    );
}
```

### Recovery Code Format

```csharp
private string GenerateRandomCode(int length)
{
    const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude ambiguous chars
    var random = new Random();
    return new string(Enumerable.Repeat(chars, length)
        .Select(s => s[random.Next(s.Length)]).ToArray());
}
```

---

## Next Steps

1. **Review & Approval:** Get stakeholder approval for this plan
2. **Sprint Planning:** Allocate 2-3 sprints for implementation
3. **Environment Setup:** Ensure NTP sync on production servers
4. **HTTPS Enforcement:** Enable HTTPS before implementing 2FA
5. **Phased Rollout:**
   - Phase 1: Optional 2FA for all users
   - Phase 2: Mandatory 2FA for admin roles
   - Phase 3: Encourage all users to enable 2FA

---

**Document Status:** Ready for implementation
**Last Updated:** 2026-02-20
**Next Review:** After Phase 1 completion
