package usecase

import (
	"context"
	"errors"

	"golang.org/x/crypto/bcrypt"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/staff"
)

// ErrInvalidCredentials means the username or password did not match.
var ErrInvalidCredentials = errors.New("invalid credentials")

// TokenIssuer issues an access token for a staff id.
type TokenIssuer interface {
	Issue(staffID int64) (string, error)
}

// AuthService logs staff users in.
type AuthService struct {
	repo   staff.Repository
	issuer TokenIssuer
}

// NewAuthService builds the auth service.
func NewAuthService(repo staff.Repository, issuer TokenIssuer) *AuthService {
	return &AuthService{repo: repo, issuer: issuer}
}

// Login checks the credentials and returns a signed token.
func (s *AuthService) Login(ctx context.Context, username, password string) (string, error) {
	user, err := s.repo.GetByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, staff.ErrNotFound) {
			return "", ErrInvalidCredentials
		}
		return "", err
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		return "", ErrInvalidCredentials
	}
	return s.issuer.Issue(user.ID)
}
