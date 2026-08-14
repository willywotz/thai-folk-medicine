package main

import (
	"bytes"
	"image/jpeg"
	"math/rand"
	"testing"
	"time"
)

func newRand() *rand.Rand { return rand.New(rand.NewSource(1)) }

func TestRandomHealer(t *testing.T) {
	h := randomHealer(newRand(), 7)
	if h.DistrictID != 7 {
		t.Errorf("DistrictID = %d, want 7", h.DistrictID)
	}
	if h.FullName == "" {
		t.Error("FullName is empty")
	}
	if h.Specialty == "" {
		t.Error("Specialty is empty")
	}
	if h.SubDistrict == "" {
		t.Error("SubDistrict is empty")
	}
	if h.Biography == "" {
		t.Error("Biography is empty")
	}
}

func TestRandomRemedy(t *testing.T) {
	rm := randomRemedy(newRand(), 12)
	if rm.HealerID != 12 {
		t.Errorf("HealerID = %d, want 12", rm.HealerID)
	}
	if rm.Name == "" {
		t.Error("Name is empty")
	}
	if rm.Symptoms == "" {
		t.Error("Symptoms is empty")
	}
	if rm.Ingredients == "" {
		t.Error("Ingredients is empty")
	}
	if rm.PreparationMethod == "" {
		t.Error("PreparationMethod is empty")
	}
	if rm.Usage == "" {
		t.Error("Usage is empty")
	}
}

func TestRandomCase(t *testing.T) {
	now := time.Date(2026, 8, 14, 0, 0, 0, 0, time.UTC)
	c := randomCase(newRand(), now, 3, 5)
	if c.RemedyID != 3 || c.HealerID != 5 {
		t.Errorf("ids = (%d,%d), want (3,5)", c.RemedyID, c.HealerID)
	}
	if c.PatientAge <= 0 {
		t.Errorf("PatientAge = %d, want > 0", c.PatientAge)
	}
	if c.PatientSex == "" {
		t.Error("PatientSex is empty")
	}
	if c.Symptoms == "" {
		t.Error("Symptoms is empty")
	}
	if c.Result == "" {
		t.Error("Result is empty")
	}
	if c.TreatedOn.IsZero() {
		t.Error("TreatedOn is zero")
	}
	if c.TreatedOn.After(now) {
		t.Errorf("TreatedOn %v is in the future", c.TreatedOn)
	}
}

func TestGeneratorsAreDeterministic(t *testing.T) {
	a := randomHealer(newRand(), 1)
	b := randomHealer(newRand(), 1)
	if a != b {
		t.Errorf("same seed gave different healers: %+v vs %+v", a, b)
	}
}

func TestPlaceholderJPEG(t *testing.T) {
	raw := placeholderJPEG(120)
	if len(raw) == 0 {
		t.Fatal("empty JPEG")
	}
	if _, err := jpeg.Decode(bytes.NewReader(raw)); err != nil {
		t.Errorf("decode: %v", err)
	}
}
