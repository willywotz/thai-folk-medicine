package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/staff"
)

type fakeStaffRepo struct {
	user staff.Staff
	err  error
}

func (f *fakeStaffRepo) GetByUsername(_ context.Context, username string) (staff.Staff, error) {
	if f.err != nil {
		return staff.Staff{}, f.err
	}
	if username != f.user.Username {
		return staff.Staff{}, staff.ErrNotFound
	}
	return f.user, nil
}
func (f *fakeStaffRepo) Create(context.Context, staff.CreateParams) (staff.Staff, error) {
	return staff.Staff{}, nil
}
func (f *fakeStaffRepo) Count(context.Context) (int64, error) { return 0, nil }

type fakeIssuer struct{ issued int64 }

func (f *fakeIssuer) Issue(staffID int64) (string, error) {
	f.issued = staffID
	return "token-for-" + string(rune(staffID)), nil
}

func staffWithPassword(t *testing.T, password string) staff.Staff {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	require.NoError(t, err)
	return staff.Staff{ID: 7, Username: "admin", PasswordHash: string(hash)}
}

func TestLoginSucceedsWithCorrectPassword(t *testing.T) {
	repo := &fakeStaffRepo{user: staffWithPassword(t, "secret")}
	issuer := &fakeIssuer{}
	service := NewAuthService(repo, issuer)

	tok, err := service.Login(context.Background(), "admin", "secret")

	require.NoError(t, err)
	assert.NotEmpty(t, tok)
	assert.Equal(t, int64(7), issuer.issued)
}

func TestLoginFailsWithWrongPassword(t *testing.T) {
	repo := &fakeStaffRepo{user: staffWithPassword(t, "secret")}
	service := NewAuthService(repo, &fakeIssuer{})

	_, err := service.Login(context.Background(), "admin", "wrong")

	assert.ErrorIs(t, err, ErrInvalidCredentials)
}

func TestLoginFailsForUnknownUser(t *testing.T) {
	repo := &fakeStaffRepo{user: staffWithPassword(t, "secret")}
	service := NewAuthService(repo, &fakeIssuer{})

	_, err := service.Login(context.Background(), "ghost", "secret")

	assert.ErrorIs(t, err, ErrInvalidCredentials)
}

func TestLoginPropagatesRepoError(t *testing.T) {
	repo := &fakeStaffRepo{err: errors.New("db down")}
	service := NewAuthService(repo, &fakeIssuer{})

	_, err := service.Login(context.Background(), "admin", "secret")

	assert.Error(t, err)
	assert.NotErrorIs(t, err, ErrInvalidCredentials)
}
