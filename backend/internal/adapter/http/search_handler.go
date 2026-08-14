package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/herb"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
	"github.com/willywotz/thai-folk-medicine/backend/internal/usecase/search"
)

// SearchHandler serves the public search endpoint.
type SearchHandler struct {
	service *search.Service
}

// NewSearchHandler builds the search handler.
func NewSearchHandler(service *search.Service) *SearchHandler {
	return &SearchHandler{service: service}
}

// RegisterRoutes mounts the public search route.
func (h *SearchHandler) RegisterRoutes(public, _ *gin.RouterGroup) {
	public.GET("/search", h.Search)
}

type remedyMatchDTO struct {
	ID             int64  `json:"id"`
	Name           string `json:"name"`
	Symptoms       string `json:"symptoms"`
	HealerID       int64  `json:"healerId"`
	HealerFullName string `json:"healerFullName"`
}

type healerMatchDTO struct {
	ID          int64  `json:"id"`
	FullName    string `json:"fullName"`
	Specialty   string `json:"specialty"`
	SubDistrict string `json:"subDistrict"`
	DistrictID  int64  `json:"districtId"`
}

type herbMatchDTO struct {
	ID             int64  `json:"id"`
	NameThai       string `json:"nameThai"`
	NameEnglish    string `json:"nameEnglish"`
	ScientificName string `json:"scientificName"`
}

type searchResponseDTO struct {
	Remedies []remedyMatchDTO `json:"remedies"`
	Healers  []healerMatchDTO `json:"healers"`
	Herbs    []herbMatchDTO   `json:"herbs"`
}

func toRemedyMatchDTO(r remedy.SearchResult) remedyMatchDTO {
	return remedyMatchDTO{
		ID:             r.ID,
		Name:           r.Name,
		Symptoms:       r.Symptoms,
		HealerID:       r.HealerID,
		HealerFullName: r.HealerFullName,
	}
}

func toHerbMatchDTO(h herb.Herb) herbMatchDTO {
	return herbMatchDTO{
		ID:             h.ID,
		NameThai:       h.NameThai,
		NameEnglish:    h.NameEnglish,
		ScientificName: h.ScientificName,
	}
}

func toHealerMatchDTO(h healer.Healer) healerMatchDTO {
	return healerMatchDTO{
		ID:          h.ID,
		FullName:    h.FullName,
		Specialty:   h.Specialty,
		SubDistrict: h.SubDistrict,
		DistrictID:  h.DistrictID,
	}
}

// Search handles GET /api/v1/search.
func (h *SearchHandler) Search(c *gin.Context) {
	result, err := h.service.Search(c.Request.Context(), c.Query("searchTerm"))
	if err != nil {
		if errors.Is(err, search.ErrTermTooShort) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "search term must be at least two characters"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot run search"})
		return
	}
	out := searchResponseDTO{
		Remedies: make([]remedyMatchDTO, 0, len(result.Remedies)),
		Healers:  make([]healerMatchDTO, 0, len(result.Healers)),
		Herbs:    make([]herbMatchDTO, 0, len(result.Herbs)),
	}
	for _, r := range result.Remedies {
		out.Remedies = append(out.Remedies, toRemedyMatchDTO(r))
	}
	for _, hh := range result.Healers {
		out.Healers = append(out.Healers, toHealerMatchDTO(hh))
	}
	for _, hb := range result.Herbs {
		out.Herbs = append(out.Herbs, toHerbMatchDTO(hb))
	}
	c.JSON(http.StatusOK, out)
}
