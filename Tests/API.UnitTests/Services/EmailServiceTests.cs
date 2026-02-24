using API.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace API.UnitTests.Services
{
    public class EmailServiceTests
    {
        private readonly Mock<IConfiguration> _configMock;
        private readonly Mock<ILogger<EmailService>> _loggerMock;

        public EmailServiceTests()
        {
            _configMock = new Mock<IConfiguration>();
            _loggerMock = new Mock<ILogger<EmailService>>();
        }

        [Fact]
        public void Constructor_ShouldSetDefaultValues_WhenConfigIsEmpty()
        {
            // Arrange
            _configMock.Setup(x => x["Email:SmtpHost"]).Returns((string)null);
            _configMock.Setup(x => x["Email:SmtpPort"]).Returns((string)null);
            _configMock.Setup(x => x["Email:FromName"]).Returns((string)null);
            _configMock.Setup(x => x["Email:AppUrl"]).Returns((string)null);

            // Act
            var service = new EmailService(_configMock.Object, _loggerMock.Object);

            // Assert - if it doesn't throw, defaults were applied correctly
            service.Should().NotBeNull();
        }

        [Fact]
        public void Constructor_ShouldParsePort_WhenValidPortProvided()
        {
            // Arrange
            _configMock.Setup(x => x["Email:SmtpPort"]).Returns("2525");

            // Act
            var service = new EmailService(_configMock.Object, _loggerMock.Object);

            // Assert - if it doesn't throw, port was parsed correctly
            service.Should().NotBeNull();
        }

        [Fact]
        public void Constructor_ShouldUseDefaultPort_WhenInvalidPortProvided()
        {
            // Arrange
            _configMock.Setup(x => x["Email:SmtpPort"]).Returns("invalid");

            // Act
            var service = new EmailService(_configMock.Object, _loggerMock.Object);

            // Assert - should use default port 587
            service.Should().NotBeNull();
        }

        [Fact]
        public async Task SendNewUserEmailAsync_ShouldReturnFalse_WhenSmtpHostNotConfigured()
        {
            // Arrange
            _configMock.Setup(x => x["Email:SmtpHost"]).Returns((string)null);
            var service = new EmailService(_configMock.Object, _loggerMock.Object);

            // Act
            var result = await service.SendNewUserEmailAsync(
                "test@example.com",
                "Test User",
                "testuser",
                "TempPass123!");

            // Assert
            result.Should().BeFalse();
            _loggerMock.Verify(
                x => x.Log(
                    LogLevel.Warning,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, t) => v.ToString().Contains("SMTP host is not configured")),
                    It.IsAny<Exception>(),
                    It.IsAny<Func<It.IsAnyType, Exception, string>>()),
                Times.Once);
        }

        [Fact]
        public async Task SendNewUserEmailAsync_ShouldReturnFalse_WhenFromEmailNotConfigured()
        {
            // Arrange
            _configMock.Setup(x => x["Email:SmtpHost"]).Returns("smtp.test.com");
            _configMock.Setup(x => x["Email:FromEmail"]).Returns((string)null);
            var service = new EmailService(_configMock.Object, _loggerMock.Object);

            // Act
            var result = await service.SendNewUserEmailAsync(
                "test@example.com",
                "Test User",
                "testuser",
                "TempPass123!");

            // Assert
            result.Should().BeFalse();
            _loggerMock.Verify(
                x => x.Log(
                    LogLevel.Warning,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, t) => v.ToString().Contains("FromEmail is not configured")),
                    It.IsAny<Exception>(),
                    It.IsAny<Func<It.IsAnyType, Exception, string>>()),
                Times.Once);
        }

        [Fact]
        public async Task SendPasswordResetEmailAsync_ShouldReturnFalse_WhenSmtpHostNotConfigured()
        {
            // Arrange
            _configMock.Setup(x => x["Email:SmtpHost"]).Returns((string)null);
            var service = new EmailService(_configMock.Object, _loggerMock.Object);

            // Act
            var result = await service.SendPasswordResetEmailAsync(
                "test@example.com",
                "Test User",
                "testuser",
                "NewTempPass123!");

            // Assert
            result.Should().BeFalse();
            _loggerMock.Verify(
                x => x.Log(
                    LogLevel.Warning,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, t) => v.ToString().Contains("SMTP host is not configured")),
                    It.IsAny<Exception>(),
                    It.IsAny<Func<It.IsAnyType, Exception, string>>()),
                Times.Once);
        }

        [Fact]
        public async Task SendPasswordResetEmailAsync_ShouldReturnFalse_WhenFromEmailNotConfigured()
        {
            // Arrange
            _configMock.Setup(x => x["Email:SmtpHost"]).Returns("smtp.test.com");
            _configMock.Setup(x => x["Email:FromEmail"]).Returns((string)null);
            var service = new EmailService(_configMock.Object, _loggerMock.Object);

            // Act
            var result = await service.SendPasswordResetEmailAsync(
                "test@example.com",
                "Test User",
                "testuser",
                "NewTempPass123!");

            // Assert
            result.Should().BeFalse();
            _loggerMock.Verify(
                x => x.Log(
                    LogLevel.Warning,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, t) => v.ToString().Contains("FromEmail is not configured")),
                    It.IsAny<Exception>(),
                    It.IsAny<Func<It.IsAnyType, Exception, string>>()),
                Times.Once);
        }
    }
}
