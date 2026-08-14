package main

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"math/rand"
	"strings"
	"time"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/healer"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/treatmentcase"
)

// Curated Thai content pools. The generators combine them at random to build
// realistic demo rows without hand-authoring every record.
var (
	titlePool     = []string{"หมอ", "พ่อหมอ", "แม่หมอ", "ปู่หมอ", "ยายหมอ"}
	firstNamePool = []string{"สมชาย", "บุญมี", "คำ", "ทองดี", "จันทร์", "สุพรรณ", "บัวลา", "ประเสริฐ", "แก้ว", "หนูพิน", "สมบูรณ์", "ทองใบ"}
	lastNamePool  = []string{"ศรีสุข", "แสงทอง", "ทองคำ", "บุญเรือง", "วงศ์คำ", "สายทอง", "จันทะโส", "ดวงแก้ว", "พันธ์โคตร", "มาลาศรี"}
	subDistrict   = []string{"ตำบลในเมือง", "ตำบลสำราญ", "ตำบลตาดทอง", "ตำบลค้อเหนือ", "ตำบลหนองหิน", "ตำบลกำแมด", "ตำบลโพนงาม", "ตำบลนาโส่"}
	specialtyPool = []string{"ยาสมุนไพร", "หมอนวดแผนไทย", "หมอกระดูก", "หมอยาต้ม", "หมอเป่า", "หมอตำแย", "ยารักษาโรคเด็ก", "ยาพอกสมุนไพร"}

	herbPool    = []string{"ฟ้าทะลายโจร", "ขมิ้นชัน", "ไพล", "กระชายดำ", "บอระเพ็ด", "ขิง", "ตะไคร้", "ใบมะกรูด", "ว่านหางจระเข้", "รางจืด", "ย่านาง", "มะขามป้อม", "เพชรสังฆาต", "ขี้เหล็ก"}
	symptomPool = []string{"ไข้", "ปวดเมื่อยกล้ามเนื้อ", "ท้องอืดท้องเฟ้อ", "ปวดข้อ", "แผลสด", "ผื่นคัน", "ไอ", "นอนไม่หลับ", "ปวดศีรษะ", "ท้องเสีย", "ความดันสูง", "เบาหวาน"}

	remedyForm      = []string{"ยาต้ม", "ยาลูกกลอน", "ยาพอก", "ยาชง", "ยาดอง", "ยาผง"}
	preparationPool = []string{
		"ต้มกับน้ำสะอาดจนเดือด แล้วเคี่ยวให้งวดลงครึ่งหนึ่ง",
		"ตากแดดให้แห้ง บดเป็นผงละเอียด ปั้นเป็นลูกกลอน",
		"ตำให้ละเอียด ผสมน้ำอุ่นเล็กน้อยจนเป็นเนื้อเดียว",
		"หั่นเป็นชิ้นเล็ก ชงกับน้ำร้อนทิ้งไว้ห้านาที",
		"ดองกับเหล้าขาวนานเจ็ดวัน กรองเอาแต่น้ำ",
	}
	usagePool = []string{
		"ดื่มครั้งละครึ่งแก้ว วันละสองครั้ง ก่อนอาหารเช้าและเย็น",
		"รับประทานครั้งละสองเม็ด หลังอาหารสามมื้อ",
		"พอกบริเวณที่ปวดวันละครั้ง ทิ้งไว้สามสิบนาที",
		"ดื่มขณะยังอุ่น วันละหนึ่งครั้งก่อนนอน",
		"จิบทีละน้อยตลอดวันจนกว่าอาการจะทุเลา",
	}
	notePool = []string{
		"ห้ามใช้ในหญิงตั้งครรภ์",
		"ควรงดของแสลงระหว่างใช้ยา",
		"เก็บในที่แห้งและพ้นแสงแดด",
		"หากอาการไม่ดีขึ้นภายในสามวันให้พบแพทย์",
		"",
	}
	resultPool = []string{"อาการทุเลาลงภายในสามวัน", "หายเป็นปกติหลังใช้ยาครบสัปดาห์", "อาการดีขึ้นอย่างชัดเจน", "ทุเลาบางส่วน แนะนำให้ใช้ยาต่อ"}
	sexPool    = []string{"ชาย", "หญิง"}
	amountPool = []string{"1 กำมือ", "2 กำมือ", "1 ช้อนโต๊ะ", "ครึ่งกิโลกรัม", "3 หัว", "1 กอบ"}
)

// herbSeed is one curated herb for the demo.
type herbSeed struct {
	NameThai       string
	NameEnglish    string
	ScientificName string
	Properties     string
}

var herbSeedPool = []herbSeed{
	{"ฟ้าทะลายโจร", "Andrographis", "Andrographis paniculata", "แก้ไข้ เจ็บคอ"},
	{"ขมิ้นชัน", "Turmeric", "Curcuma longa", "แก้ท้องอืด สมานแผล"},
	{"ไพล", "Cassumunar ginger", "Zingiber cassumunar", "แก้ปวดเมื่อย"},
	{"กระชายดำ", "Black galingale", "Kaempferia parviflora", "บำรุงกำลัง"},
	{"บอระเพ็ด", "Tinospora", "Tinospora crispa", "แก้ไข้ เจริญอาหาร"},
	{"ขิง", "Ginger", "Zingiber officinale", "ขับลม แก้คลื่นไส้"},
	{"ตะไคร้", "Lemongrass", "Cymbopogon citratus", "ขับลม แก้ท้องอืด"},
	{"ว่านหางจระเข้", "Aloe vera", "Aloe vera", "สมานแผล แก้ร้อนใน"},
	{"รางจืด", "Blue trumpet vine", "Thunbergia laurifolia", "ถอนพิษ"},
	{"ย่านาง", "Bamboo grass", "Tiliacora triandra", "ลดไข้ บำรุง"},
	{"มะขามป้อม", "Indian gooseberry", "Phyllanthus emblica", "แก้ไอ ขับเสมหะ"},
	{"เพชรสังฆาต", "Veldt grape", "Cissus quadrangularis", "แก้ริดสีดวง"},
}

func pick(r *rand.Rand, pool []string) string { return pool[r.Intn(len(pool))] }

// pickSome returns 2..max distinct items joined with a Thai comma.
func pickSome(r *rand.Rand, pool []string, max int) string {
	n := 2 + r.Intn(max-1)
	perm := r.Perm(len(pool))
	out := make([]string, 0, n)
	for i := 0; i < n && i < len(perm); i++ {
		out = append(out, pool[perm[i]])
	}
	return strings.Join(out, " ")
}

func randomHealer(r *rand.Rand, districtID int64) healer.CreateParams {
	name := fmt.Sprintf("%s%s %s", pick(r, titlePool), pick(r, firstNamePool), pick(r, lastNamePool))
	spec := pick(r, specialtyPool)
	return healer.CreateParams{
		DistrictID:  districtID,
		FullName:    name,
		SubDistrict: pick(r, subDistrict),
		Specialty:   spec,
		Biography:   fmt.Sprintf("สืบทอดวิชา%sจากบรรพบุรุษ รักษาชาวบ้านในพื้นที่มากว่า %d ปี", spec, 10+r.Intn(40)),
	}
}

// randomAmount returns a Thai amount string for a herb link.
func randomAmount(r *rand.Rand) string { return pick(r, amountPool) }

// pickHerbRefs picks 2..4 distinct herb ids with a random amount each.
func pickHerbRefs(r *rand.Rand, herbIDs []int64) []remedy.HerbRef {
	n := 2 + r.Intn(3)
	if n > len(herbIDs) {
		n = len(herbIDs)
	}
	perm := r.Perm(len(herbIDs))
	refs := make([]remedy.HerbRef, 0, n)
	for i := range n {
		refs = append(refs, remedy.HerbRef{HerbID: herbIDs[perm[i]], Amount: randomAmount(r)})
	}
	return refs
}

func randomRemedy(r *rand.Rand, healerID int64) remedy.CreateParams {
	form := pick(r, remedyForm)
	herb := pick(r, herbPool)
	return remedy.CreateParams{
		HealerID:          healerID,
		Name:              fmt.Sprintf("%s%s", form, herb),
		Symptoms:          pickSome(r, symptomPool, 3),
		PreparationMethod: pick(r, preparationPool),
		Usage:             pick(r, usagePool),
		Note:              pick(r, notePool),
	}
}

func randomCase(r *rand.Rand, now time.Time, remedyID, healerID int64) treatmentcase.CreateParams {
	daysAgo := 1 + r.Intn(720)
	return treatmentcase.CreateParams{
		RemedyID:   remedyID,
		HealerID:   healerID,
		PatientAge: 5 + r.Intn(80),
		PatientSex: pick(r, sexPool),
		Symptoms:   pickSome(r, symptomPool, 3),
		Result:     pick(r, resultPool),
		Note:       pick(r, notePool),
		TreatedOn:  now.AddDate(0, 0, -daysAgo),
	}
}

// placeholderJPEG builds a small solid-colour JPEG so the demo has images
// without checking binary assets into the repo. hue seeds the colour.
func placeholderJPEG(hue int) []byte {
	const size = 400
	img := image.NewRGBA(image.Rect(0, 0, size, size))
	c := color.RGBA{R: uint8(hue % 256), G: uint8((hue * 3) % 256), B: uint8((hue * 7) % 256), A: 255}
	for y := range size {
		for x := range size {
			img.Set(x, y, c)
		}
	}
	var buf bytes.Buffer
	_ = jpeg.Encode(&buf, img, &jpeg.Options{Quality: 80})
	return buf.Bytes()
}
