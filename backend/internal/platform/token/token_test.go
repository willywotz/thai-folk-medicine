package token

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIssueThenVerifyRoundTrips(t *testing.T) {
	m := NewManager("secret", time.Hour)

	tok, err := m.Issue(42)
	require.NoError(t, err)
	require.NotEmpty(t, tok)

	id, err := m.Verify(tok)
	require.NoError(t, err)
	assert.Equal(t, int64(42), id)
}

func TestVerifyRejectsGarbage(t *testing.T) {
	m := NewManager("secret", time.Hour)
	_, err := m.Verify("not-a-token")
	assert.Error(t, err)
}

func TestVerifyRejectsWrongSecret(t *testing.T) {
	tok, err := NewManager("secret-a", time.Hour).Issue(1)
	require.NoError(t, err)

	_, err = NewManager("secret-b", time.Hour).Verify(tok)
	assert.Error(t, err)
}

func TestVerifyRejectsExpired(t *testing.T) {
	m := NewManager("secret", -time.Minute) // already expired
	tok, err := m.Issue(1)
	require.NoError(t, err)

	_, err = m.Verify(tok)
	assert.Error(t, err)
}
