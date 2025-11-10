# Security Policy

## Supported Versions

We take security seriously. This section outlines which versions of the Minecraft Multi-Server System are currently supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please help us by reporting it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing:

- **Email**: [your-security-email@example.com]
- **Subject**: `[SECURITY] Vulnerability Report - Minecraft Multi-Server System`

### What to Include

When reporting a security vulnerability, please include:

- A clear description of the vulnerability
- Steps to reproduce the issue
- Potential impact and severity
- Any suggested fixes or mitigations
- Your contact information for follow-up

### Response Timeline

We will acknowledge your report within **48 hours** and provide a more detailed response within **7 days** indicating our next steps.

We will keep you informed about our progress throughout the process of fixing the vulnerability.

### Disclosure Policy

- We follow a **responsible disclosure** process
- We will credit reporters in our security advisories (unless you prefer to remain anonymous)
- We will not disclose vulnerability details until a fix is available
- We will coordinate public disclosure with the reporter

## Security Best Practices

### For Users

When deploying this system:

1. **Keep Docker updated** to the latest stable version
2. **Use strong passwords** for RCON and admin accounts
3. **Limit network exposure** - don't expose management ports publicly
4. **Regular backups** - test backup restoration regularly
5. **Monitor logs** for suspicious activity
6. **Keep modpacks updated** to avoid known vulnerabilities
7. **Use firewall rules** to restrict access to server ports

### For Contributors

When contributing code:

1. **Validate input** - never trust user input
2. **Use secure defaults** - prefer secure over convenient
3. **Avoid hardcoding secrets** - use environment variables
4. **Follow principle of least privilege** - minimal required permissions
5. **Keep dependencies updated** - regular security audits
6. **Document security considerations** in code comments

## Known Security Considerations

### Docker Security

- Containers run with necessary privileges for Minecraft server operation
- Host filesystem access is limited to designated directories
- Network isolation depends on Docker configuration

### Minecraft Server Security

- Default configurations prioritize functionality over security
- RCON is enabled by default for management (change password!)
- Online mode is disabled by default (LAN/offline play)
- No default whitelist (configure as needed)

### Backup Security

- Backups contain world data and may include sensitive information
- Store backups securely and encrypt if necessary
- Test backup integrity regularly

## Security Updates

Security updates will be:

- Released as soon as possible after verification
- Documented in release notes with CVE identifiers when applicable
- Communicated through GitHub Security Advisories
- Backported to supported versions when feasible

## Contact

For security-related questions or concerns:

- **Security Issues**: [your-security-email@example.com]
- **General Support**: [your-general-email@example.com]
- **GitHub Issues**: For non-security related issues

## Acknowledgments

We appreciate the security research community for helping keep open source projects secure. Thank you for your responsible disclosure and contributions to security.
