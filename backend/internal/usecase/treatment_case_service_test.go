package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/event"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/treatmentcase"
)

type fakeCaseRepo struct{ createErr error }

func (f *fakeCaseRepo) Create(_ context.Context, p treatmentcase.CreateParams) (treatmentcase.TreatmentCase, error) {
	if f.createErr != nil {
		return treatmentcase.TreatmentCase{}, f.createErr
	}
	return treatmentcase.TreatmentCase{ID: 1, RemedyID: p.RemedyID, HealerID: p.HealerID}, nil
}
func (f *fakeCaseRepo) GetByID(context.Context, int64) (treatmentcase.TreatmentCase, error) {
	return treatmentcase.TreatmentCase{ID: 1}, nil
}
func (f *fakeCaseRepo) ListByRemedy(context.Context, int64) ([]treatmentcase.TreatmentCase, error) {
	return []treatmentcase.TreatmentCase{{ID: 1}}, nil
}
func (f *fakeCaseRepo) Update(_ context.Context, p treatmentcase.UpdateParams) (treatmentcase.TreatmentCase, error) {
	return treatmentcase.TreatmentCase{ID: p.ID}, nil
}
func (f *fakeCaseRepo) Delete(context.Context, int64) error { return nil }

type caseRecorder struct{ events []event.Event }

func (r *caseRecorder) Publish(_ context.Context, e event.Event) { r.events = append(r.events, e) }

func validCreate() treatmentcase.CreateParams {
	return treatmentcase.CreateParams{RemedyID: 2, HealerID: 3, PatientAge: 40, PatientSex: "male", TreatedOn: time.Now().UTC()}
}

func TestCreateCasePublishesEvent(t *testing.T) {
	pub := &caseRecorder{}
	got, err := NewTreatmentCaseService(&fakeCaseRepo{}, pub).Create(context.Background(), validCreate())
	require.NoError(t, err)
	assert.Equal(t, int64(1), got.ID)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "treatmentcase.created", pub.events[0].EventName())
}

func TestCreateCaseRejectsBadRemedy(t *testing.T) {
	p := validCreate()
	p.RemedyID = 0
	pub := &caseRecorder{}
	_, err := NewTreatmentCaseService(&fakeCaseRepo{}, pub).Create(context.Background(), p)
	assert.ErrorIs(t, err, ErrInvalidTreatmentCase)
	assert.Empty(t, pub.events)
}

func TestCreateCaseRejectsEmptySex(t *testing.T) {
	p := validCreate()
	p.PatientSex = ""
	_, err := NewTreatmentCaseService(&fakeCaseRepo{}, &caseRecorder{}).Create(context.Background(), p)
	assert.ErrorIs(t, err, ErrInvalidTreatmentCase)
}

func TestCreateCaseRejectsNegativeAge(t *testing.T) {
	p := validCreate()
	p.PatientAge = -1
	_, err := NewTreatmentCaseService(&fakeCaseRepo{}, &caseRecorder{}).Create(context.Background(), p)
	assert.ErrorIs(t, err, ErrInvalidTreatmentCase)
}

func TestCreateCaseNoEventOnRepoError(t *testing.T) {
	pub := &caseRecorder{}
	_, err := NewTreatmentCaseService(&fakeCaseRepo{createErr: errors.New("db")}, pub).Create(context.Background(), validCreate())
	require.Error(t, err)
	assert.Empty(t, pub.events)
}

func TestDeleteCasePublishesEvent(t *testing.T) {
	pub := &caseRecorder{}
	require.NoError(t, NewTreatmentCaseService(&fakeCaseRepo{}, pub).Delete(context.Background(), 9))
	require.Len(t, pub.events, 1)
	assert.Equal(t, "treatmentcase.deleted", pub.events[0].EventName())
}
