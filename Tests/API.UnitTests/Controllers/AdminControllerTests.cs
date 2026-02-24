using API.Controllers;
using API.DTOs;
using API.Services;
using Application.Interfaces;
using Domain;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Moq;
using Persistence;
using System;
using System.Threading.Tasks;
using Xunit;

namespace API.UnitTests.Controllers
{
    public class AdminControllerTests
    {
        private readonly Mock<UserManager<User>> _userManagerMock;
        private readonly Mock<RoleManager<IdentityRole>> _roleManagerMock;
        private readonly DataContext _context;
        private readonly Mock<IHostEnvironment> _environmentMock;
        private readonly Mock<IEmailService> _emailServiceMock;
        private readonly Mock<ILogger<AdminController>> _loggerMock;
        private readonly AdminController _controller;

        public AdminControllerTests()
        {
            // Mock UserManager
            var userStoreMock = new Mock<IUserStore<User>>();
            _userManagerMock = new Mock<UserManager<User>>(
                userStoreMock.Object, null, null, null, null, null, null, null, null);

            // Mock RoleManager
            var roleStoreMock = new Mock<IRoleStore<IdentityRole>>();
            _roleManagerMock = new Mock<RoleManager<IdentityRole>>(
                roleStoreMock.Object, null, null, null, null);

            // Use in-memory database
            var options = new DbContextOptionsBuilder<DataContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new DataContext(options);

            _environmentMock = new Mock<IHostEnvironment>();
            _emailServiceMock = new Mock<IEmailService>();
            _loggerMock = new Mock<ILogger<AdminController>>();

            _controller = new AdminController(
                _userManagerMock.Object,
                _roleManagerMock.Object,
                _context,
                _environmentMock.Object,
                _emailServiceMock.Object,
                _loggerMock.Object);
        }

        [Fact]
        public void GenerateRandomPassword_ShouldCreatePasswordWithCorrectLength()
        {
            // Use reflection to call private method
            var method = typeof(AdminController).GetMethod("GenerateRandomPassword",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);

            // Act
            var password = method.Invoke(_controller, null) as string;

            // Assert
            password.Should().NotBeNullOrEmpty();
            password.Length.Should().Be(6);
        }

        [Fact]
        public void GenerateRandomPassword_ShouldContainUppercase()
        {
            // Use reflection to call private method
            var method = typeof(AdminController).GetMethod("GenerateRandomPassword",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);

            // Act
            var password = method.Invoke(_controller, null) as string;

            // Assert
            password.Should().MatchRegex("[A-Z]", "password should contain at least one uppercase letter");
        }

        [Fact]
        public void GenerateRandomPassword_ShouldContainLowercase()
        {
            // Use reflection to call private method
            var method = typeof(AdminController).GetMethod("GenerateRandomPassword",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);

            // Act
            var password = method.Invoke(_controller, null) as string;

            // Assert
            password.Should().MatchRegex("[a-z]", "password should contain at least one lowercase letter");
        }

        [Fact]
        public void GenerateRandomPassword_ShouldContainDigit()
        {
            // Use reflection to call private method
            var method = typeof(AdminController).GetMethod("GenerateRandomPassword",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);

            // Act
            var password = method.Invoke(_controller, null) as string;

            // Assert
            password.Should().MatchRegex("[0-9]", "password should contain at least one digit");
        }

        [Fact]
        public void GenerateRandomPassword_ShouldContainSpecialCharacter()
        {
            // Use reflection to call private method
            var method = typeof(AdminController).GetMethod("GenerateRandomPassword",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);

            // Act
            var password = method.Invoke(_controller, null) as string;

            // Assert
            password.Should().MatchRegex("[!@#$%^&*]", "password should contain at least one special character");
        }

        [Fact]
        public void GenerateRandomPassword_ShouldGenerateDifferentPasswords()
        {
            // Use reflection to call private method
            var method = typeof(AdminController).GetMethod("GenerateRandomPassword",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);

            // Act
            var password1 = method.Invoke(_controller, null) as string;
            var password2 = method.Invoke(_controller, null) as string;
            var password3 = method.Invoke(_controller, null) as string;

            // Assert
            password1.Should().NotBe(password2);
            password2.Should().NotBe(password3);
            password1.Should().NotBe(password3);
        }

        [Fact]
        public async Task SendPasswordResetLink_ShouldReturnNotFound_WhenUserDoesNotExist()
        {
            // Arrange
            _userManagerMock.Setup(x => x.FindByIdAsync(It.IsAny<string>()))
                .ReturnsAsync((User)null);

            // Act
            var result = await _controller.SendPasswordResetLink("nonexistent-id");

            // Assert
            result.Result.Should().BeOfType<NotFoundResult>();
        }

        [Fact]
        public async Task SendPasswordResetLink_ShouldReturnBadRequest_WhenPasswordResetFails()
        {
            // Arrange
            var user = new User { Id = "test-id", Email = "test@example.com", DisplayName = "Test User" };
            _userManagerMock.Setup(x => x.FindByIdAsync("test-id")).ReturnsAsync(user);
            _userManagerMock.Setup(x => x.GeneratePasswordResetTokenAsync(user)).ReturnsAsync("reset-token");
            _userManagerMock.Setup(x => x.ResetPasswordAsync(user, "reset-token", It.IsAny<string>()))
                .ReturnsAsync(IdentityResult.Failed(new IdentityError { Description = "Password reset failed" }));

            // Act
            var result = await _controller.SendPasswordResetLink("test-id");

            // Assert
            result.Result.Should().BeOfType<BadRequestObjectResult>();
            var badRequestResult = result.Result as BadRequestObjectResult;
            badRequestResult.Value.Should().Be("Failed to reset password");
        }

        [Fact]
        public async Task SendPasswordResetLink_ShouldSetMustChangePasswordFlag()
        {
            // Arrange
            var user = new User
            {
                Id = "test-id",
                Email = "test@example.com",
                DisplayName = "Test User",
                MustChangePassword = false
            };
            _userManagerMock.Setup(x => x.FindByIdAsync("test-id")).ReturnsAsync(user);
            _userManagerMock.Setup(x => x.GeneratePasswordResetTokenAsync(user)).ReturnsAsync("reset-token");
            _userManagerMock.Setup(x => x.ResetPasswordAsync(user, "reset-token", It.IsAny<string>()))
                .ReturnsAsync(IdentityResult.Success);
            _userManagerMock.Setup(x => x.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);
            _emailServiceMock.Setup(x => x.SendPasswordResetEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            // Act
            await _controller.SendPasswordResetLink("test-id");

            // Assert
            user.MustChangePassword.Should().BeTrue();
            _userManagerMock.Verify(x => x.UpdateAsync(user), Times.Once);
        }

        [Fact]
        public async Task SendPasswordResetLink_ShouldCallEmailService()
        {
            // Arrange
            var user = new User
            {
                Id = "test-id",
                Email = "test@example.com",
                DisplayName = "Test User"
            };
            _userManagerMock.Setup(x => x.FindByIdAsync("test-id")).ReturnsAsync(user);
            _userManagerMock.Setup(x => x.GeneratePasswordResetTokenAsync(user)).ReturnsAsync("reset-token");
            _userManagerMock.Setup(x => x.ResetPasswordAsync(user, "reset-token", It.IsAny<string>()))
                .ReturnsAsync(IdentityResult.Success);
            _userManagerMock.Setup(x => x.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);
            _emailServiceMock.Setup(x => x.SendPasswordResetEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            // Act
            await _controller.SendPasswordResetLink("test-id");

            // Assert
            _emailServiceMock.Verify(
                x => x.SendPasswordResetEmailAsync(
                    "test@example.com",
                    "Test User",
                    It.IsAny<string>(),
                    It.Is<string>(pwd => pwd.Length == 6)), // Verify password has correct length
                Times.Once);
        }

        [Fact]
        public async Task SendPasswordResetLink_ShouldReturnSuccessMessage_WhenEmailSent()
        {
            // Arrange
            var user = new User
            {
                Id = "test-id",
                Email = "test@example.com",
                DisplayName = "Test User"
            };
            _userManagerMock.Setup(x => x.FindByIdAsync("test-id")).ReturnsAsync(user);
            _userManagerMock.Setup(x => x.GeneratePasswordResetTokenAsync(user)).ReturnsAsync("reset-token");
            _userManagerMock.Setup(x => x.ResetPasswordAsync(user, "reset-token", It.IsAny<string>()))
                .ReturnsAsync(IdentityResult.Success);
            _userManagerMock.Setup(x => x.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);
            _emailServiceMock.Setup(x => x.SendPasswordResetEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(true);

            // Act
            var result = await _controller.SendPasswordResetLink("test-id");

            // Assert
            result.Result.Should().BeOfType<OkObjectResult>();
            var okResult = result.Result as OkObjectResult;
            var response = okResult.Value as dynamic;
            string message = response.GetType().GetProperty("message").GetValue(response, null);
            message.Should().Contain("Password reset email sent");
        }

        [Fact]
        public async Task SendPasswordResetLink_ShouldIncludePasswordInMessage_WhenEmailFails()
        {
            // Arrange
            var user = new User
            {
                Id = "test-id",
                Email = "test@example.com",
                DisplayName = "Test User"
            };
            _userManagerMock.Setup(x => x.FindByIdAsync("test-id")).ReturnsAsync(user);
            _userManagerMock.Setup(x => x.GeneratePasswordResetTokenAsync(user)).ReturnsAsync("reset-token");
            _userManagerMock.Setup(x => x.ResetPasswordAsync(user, "reset-token", It.IsAny<string>()))
                .ReturnsAsync(IdentityResult.Success);
            _userManagerMock.Setup(x => x.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);
            _emailServiceMock.Setup(x => x.SendPasswordResetEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(false);

            // Act
            var result = await _controller.SendPasswordResetLink("test-id");

            // Assert
            result.Result.Should().BeOfType<OkObjectResult>();
            var okResult = result.Result as OkObjectResult;
            var response = okResult.Value as dynamic;
            string message = response.GetType().GetProperty("message").GetValue(response, null);
            message.Should().Contain("email could not be sent");
            message.Should().Contain("New temporary password:");
        }
    }
}
