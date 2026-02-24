using API.Controllers;
using API.DTOs;
using API.Services;
using Application.Interfaces;
using Domain;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Moq;
using System.Threading.Tasks;
using Xunit;

namespace API.UnitTests.Controllers
{
    public class AccountControllerTests
    {
        private readonly Mock<UserManager<User>> _userManagerMock;
        private readonly Mock<SignInManager<User>> _signInManagerMock;
        private readonly Mock<TokenService> _tokenServiceMock;
        private readonly Mock<IEmailService> _emailServiceMock;
        private readonly Mock<IConfiguration> _configMock;
        private readonly AccountController _controller;

        public AccountControllerTests()
        {
            // Mock UserManager
            var userStoreMock = new Mock<IUserStore<User>>();
            _userManagerMock = new Mock<UserManager<User>>(
                userStoreMock.Object, null, null, null, null, null, null, null, null);

            // Mock SignInManager
            var contextAccessorMock = new Mock<Microsoft.AspNetCore.Http.IHttpContextAccessor>();
            var claimsFactoryMock = new Mock<Microsoft.AspNetCore.Identity.IUserClaimsPrincipalFactory<User>>();
            _signInManagerMock = new Mock<SignInManager<User>>(
                _userManagerMock.Object,
                contextAccessorMock.Object,
                claimsFactoryMock.Object,
                null, null, null, null);

            _tokenServiceMock = new Mock<TokenService>(null, null);
            _emailServiceMock = new Mock<IEmailService>();
            _configMock = new Mock<IConfiguration>();

            _configMock.Setup(x => x["Email:AppUrl"]).Returns("https://testapp.com");

            _controller = new AccountController(
                _userManagerMock.Object,
                _signInManagerMock.Object,
                _tokenServiceMock.Object,
                _emailServiceMock.Object,
                _configMock.Object);
        }

        [Fact]
        public async Task ForgotPassword_ShouldReturnSuccessMessage_EvenIfUserDoesNotExist()
        {
            // Arrange
            var dto = new ForgotPasswordDto { Email = "nonexistent@example.com" };
            _userManagerMock.Setup(x => x.FindByEmailAsync(dto.Email))
                .ReturnsAsync((User)null);

            // Act
            var result = await _controller.ForgotPassword(dto);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
            var okResult = result as OkObjectResult;
            var response = okResult.Value as dynamic;
            string message = response.GetType().GetProperty("message").GetValue(response, null);
            message.Should().Contain("If the email exists");
        }

        [Fact]
        public async Task ForgotPassword_ShouldGenerateResetToken_WhenUserExists()
        {
            // Arrange
            var user = new User
            {
                Email = "test@example.com",
                DisplayName = "Test User"
            };
            var dto = new ForgotPasswordDto { Email = user.Email };

            _userManagerMock.Setup(x => x.FindByEmailAsync(dto.Email))
                .ReturnsAsync(user);
            _userManagerMock.Setup(x => x.GeneratePasswordResetTokenAsync(user))
                .ReturnsAsync("reset-token-123");
            _emailServiceMock.Setup(x => x.SendPasswordResetLinkAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            // Act
            await _controller.ForgotPassword(dto);

            // Assert
            _userManagerMock.Verify(
                x => x.GeneratePasswordResetTokenAsync(user),
                Times.Once);
        }

        [Fact]
        public async Task ForgotPassword_ShouldSendEmail_WhenUserExists()
        {
            // Arrange
            var user = new User
            {
                Email = "test@example.com",
                DisplayName = "Test User"
            };
            var dto = new ForgotPasswordDto { Email = user.Email };

            _userManagerMock.Setup(x => x.FindByEmailAsync(dto.Email))
                .ReturnsAsync(user);
            _userManagerMock.Setup(x => x.GeneratePasswordResetTokenAsync(user))
                .ReturnsAsync("reset-token-123");
            _emailServiceMock.Setup(x => x.SendPasswordResetLinkAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            // Act
            await _controller.ForgotPassword(dto);

            // Assert
            _emailServiceMock.Verify(
                x => x.SendPasswordResetLinkAsync(
                    user.Email,
                    user.DisplayName,
                    It.Is<string>(link => link.Contains("reset-password") && link.Contains("token="))),
                Times.Once);
        }

        [Fact]
        public async Task ForgotPassword_ShouldNotSendEmail_WhenUserDoesNotExist()
        {
            // Arrange
            var dto = new ForgotPasswordDto { Email = "nonexistent@example.com" };
            _userManagerMock.Setup(x => x.FindByEmailAsync(dto.Email))
                .ReturnsAsync((User)null);

            // Act
            await _controller.ForgotPassword(dto);

            // Assert
            _emailServiceMock.Verify(
                x => x.SendPasswordResetLinkAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()),
                Times.Never);
        }

        [Fact]
        public async Task ResetPassword_ShouldReturnBadRequest_WhenUserDoesNotExist()
        {
            // Arrange
            var dto = new ResetPasswordDto
            {
                Email = "nonexistent@example.com",
                Token = "some-token",
                NewPassword = "NewPassword123!"
            };
            _userManagerMock.Setup(x => x.FindByEmailAsync(dto.Email))
                .ReturnsAsync((User)null);

            // Act
            var result = await _controller.ResetPassword(dto);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
            var badRequestResult = result as BadRequestObjectResult;
            badRequestResult.Value.Should().Be("Invalid password reset token");
        }

        [Fact]
        public async Task ResetPassword_ShouldResetPassword_WhenTokenIsValid()
        {
            // Arrange
            var user = new User
            {
                Email = "test@example.com",
                DisplayName = "Test User",
                MustChangePassword = true
            };
            var dto = new ResetPasswordDto
            {
                Email = user.Email,
                Token = "valid-token",
                NewPassword = "NewPassword123!"
            };

            _userManagerMock.Setup(x => x.FindByEmailAsync(dto.Email))
                .ReturnsAsync(user);
            _userManagerMock.Setup(x => x.ResetPasswordAsync(user, dto.Token, dto.NewPassword))
                .ReturnsAsync(IdentityResult.Success);
            _userManagerMock.Setup(x => x.UpdateAsync(user))
                .ReturnsAsync(IdentityResult.Success);

            // Act
            var result = await _controller.ResetPassword(dto);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
            _userManagerMock.Verify(
                x => x.ResetPasswordAsync(user, dto.Token, dto.NewPassword),
                Times.Once);
        }

        [Fact]
        public async Task ResetPassword_ShouldClearMustChangePasswordFlag_WhenSuccessful()
        {
            // Arrange
            var user = new User
            {
                Email = "test@example.com",
                DisplayName = "Test User",
                MustChangePassword = true
            };
            var dto = new ResetPasswordDto
            {
                Email = user.Email,
                Token = "valid-token",
                NewPassword = "NewPassword123!"
            };

            _userManagerMock.Setup(x => x.FindByEmailAsync(dto.Email))
                .ReturnsAsync(user);
            _userManagerMock.Setup(x => x.ResetPasswordAsync(user, dto.Token, dto.NewPassword))
                .ReturnsAsync(IdentityResult.Success);
            _userManagerMock.Setup(x => x.UpdateAsync(user))
                .ReturnsAsync(IdentityResult.Success);

            // Act
            await _controller.ResetPassword(dto);

            // Assert
            user.MustChangePassword.Should().BeFalse();
            _userManagerMock.Verify(x => x.UpdateAsync(user), Times.Once);
        }

        [Fact]
        public async Task ResetPassword_ShouldReturnBadRequest_WhenTokenIsInvalid()
        {
            // Arrange
            var user = new User
            {
                Email = "test@example.com",
                DisplayName = "Test User"
            };
            var dto = new ResetPasswordDto
            {
                Email = user.Email,
                Token = "invalid-token",
                NewPassword = "NewPassword123!"
            };

            _userManagerMock.Setup(x => x.FindByEmailAsync(dto.Email))
                .ReturnsAsync(user);
            _userManagerMock.Setup(x => x.ResetPasswordAsync(user, dto.Token, dto.NewPassword))
                .ReturnsAsync(IdentityResult.Failed(new IdentityError { Description = "Invalid token" }));

            // Act
            var result = await _controller.ResetPassword(dto);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
            var badRequestResult = result as BadRequestObjectResult;
            badRequestResult.Value.Should().NotBeNull();
            badRequestResult.Value.ToString().Should().Contain("Failed to reset password");
        }
    }
}
