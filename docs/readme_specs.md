# Nireekshanam: Source Requirements (converted from `readme_specs.docx`)

> This is a faithful Markdown conversion of `readme_specs.docx`. Text is kept as written, apart from formatting. Stray fragments in the original ("V", "visualize", "visualize show_widget") were left out. The detailed specification derived from this document is in [SPECS.md](SPECS.md).

---

## 1. Typical hybrid seed production cycle (reference)

While you do that, here's the typical hybrid seed production cycle I'd expect the app to follow. Knowing where your process matches or differs will help me design the right screens and data model:

1. **Planning and grower contracting:** assigning parent lines (female/male), acreage, and target yield to growers and their plots.
2. **Sowing:** recording sowing dates for the female and male parents, the planting ratio, row layout, and isolation distance checks.
3. **Field inspections:** checking at vegetative, flowering, and pre-harvest stages. This covers off-types, rogueing, pest and disease status, and photos with GPS tags.
4. **Pollination management:** tracking detasseling or emasculation (for crops like maize, cotton, or tomato), nick timing between parents, and pollination records.
5. **Certification inspections:** recording visits and approvals from the seed certification agency.
6. **Harvest:** capturing harvest date, raw seed quantity, and lot numbering.
7. **Procurement and processing:** logging receipt at the plant, moisture, cleaning and grading losses, and seed treatment.
8. **Quality testing:** recording germination, genetic purity (GOT), and physical purity results per lot.
9. **Reporting:** dashboards showing progress by grower, region, and hybrid, plus yield estimates versus actuals and inspection compliance.

When you share your flow, it would also help to know which crop or crops this is for, who will use the app (field staff, supervisors, growers, managers), and whether it needs to work offline in the field.

---

## 2. Process for monitoring Hybrid Seed Production (client's flow)

1. **Season:** Kharif/Rabi: Numeric 2 digit
2. **Year:** 2 digit numeric
3. **Crop:** 2 character Alpha Code (Hot Pepper, Okra, Tomato, Water Melon, Cucumber, Bitter Gourd, Ridge Gourd, Snake Gourd, Ridge Gourd, Onion, Capsicum, Sweet Corn)
   - a. Hybrid: 4 digit Numeric
   - b. Male: 4 digit Alpha Numeric
   - c. Female: 4 digit Alpha Numeric
4. **Organiser**
   - a. Code: 3 digit Numeric
   - b. Name
   - c. Address 1
   - d. Address 2
   - e. Village Code: 2 digit Numeric
   - f. Village
   - g. Taluk Code:
   - h. Taluk
   - i. District Code: 2 digit Numeric
   - j. District
   - k. State: 2 character Alpha
   - l. Pincode: 6 digit numeric
   - m. Mobile No: 10 digit numeric
   - n. Email: alpha numeric
5. **Farmer**
   - a. Code: 6 digit Alpha numeric
   - b. Name
   - c. Address 1
   - d. Address 2
   - e. Village Code: 2 digit Numeric
   - f. Village
   - g. Taluk Code:
   - h. Taluk
   - i. District Code: 2 digit Numeric
   - j. District
   - k. State: 2 character Alpha
   - l. Pincode: 6 digit numeric
   - m. Mobile No: 10 digit numeric
   - n. Email: alpha numeric
6. **Farm**
   - a. Area in acres, guntas, cents
   - b. Soil Type
   - c. Irrigation Source
   - d. Geo Location Lat Long
   - e. Geo Fence
   - f. Photo of Farm
7. **Date of Sowing**
   - a. Male
   - b. Female
8. **Date of Transplantation**
   - a. Male
   - b. Female
9. **Stage of Crop**
   - a. Vegetative
   - b. Male Rouging
   - c. Female Rouging before Transplantation
   - d. Pollination
   - e. Female Rouging before Maturity
   - f. Maturity
   - g. Female Rouging before Harvest
   - h. Estimation of Seed Yield
   - i. Harvesting
   - j. Plow down
   - k. Seed Collection
   - l. Final Seed Yield

---

## 3. Analysis and recommendations

The production lot is the core record. A farmer can own several farms, and one farm can grow a different hybrid each season. Every sowing date, rogueing visit, and yield figure should therefore attach to a lot, not directly to the farmer. Your codes combine neatly into a unique lot ID:

| Part          | Length | Example     |
|---------------|--------|-------------|
| Season        | 2      | 01 (Kharif) |
| Year          | 2      | 26          |
| Crop          | 2      | HP          |
| Hybrid        | 4      | 1234        |
| Organiser     | 3      | 015         |
| Farmer        | 6      | TS0042      |
| Farm sequence | 1–2    | 1           |

That gives an ID like `0126HP1234015TS00421`, which can be printed as a QR code for field tags and seed bags.

### Things to settle before building

1. **Crop list:** Ridge Gourd appears twice, so there are 11 crops. I'd suggest the codes HP, OK, TO, WM, CU, BG, RG, SG, ON, CA, and SC.
2. **Season codes:** Only Kharif and Rabi are listed. Many vegetable seed programs also run a summer season, so it's worth reserving 03.
3. **Location codes:** A 2-digit village code allows only 99 villages per taluk. Taluk code has no length specified yet. I'd load a State → District → Taluk → Village master so field staff pick from dropdowns rather than typing codes. Both organiser and farmer screens would reuse it.
4. **Farmer–organiser link:** Your list doesn't say which organiser a farmer works under. The app needs this link for reporting and access control.
5. **Area units:** Acres + guntas is Telangana/Karnataka practice, while cents is Andhra/Kerala. I'd store area in one unit and display it per state. I'd also compare the declared area against the area computed from the geo-fence.
6. **Stage order and crop differences:** "Female rogueing before transplantation" happens in the nursery, so it belongs before Vegetative, not after it. Direct-sown crops like okra, gourds, melons, cucumber, and sweet corn have no transplanting at all. Stages should be configurable per crop, so staff only see the ones that apply.

### What each stage screen would capture

| Stage                         | Key data                                                                    |
|-------------------------------|-----------------------------------------------------------------------------|
| Sowing / transplanting        | Dates for male and female, number of plants or seedlings, male:female ratio |
| Rogueing (each round)         | Visit date, off-types removed (count), remarks, photos                      |
| Pollination                   | Start and end dates, number of crosses or flowers pollinated                |
| Maturity                      | Date, crop condition                                                        |
| Yield estimation              | Plant count, fruits per plant, estimated seed kg                            |
| Harvest                       | Date, number of pickings                                                    |
| Plow down                     | Date, geo-tagged photo as proof the field was destroyed                     |
| Seed collection / final yield | Seed kg received, variance from estimate                                    |

Every stage record would also automatically store the GPS position, timestamp, the staff member who entered it, and a check that they were actually inside the farm's geo-fence. This is what makes the monitoring trustworthy.

**App approach:** Most farms will have poor connectivity, so the app should work offline and sync later. Flutter or React Native with a local database and a cloud backend is the usual choice. Alongside the mobile app, a web dashboard would give managers views of lots by stage, overdue inspections, estimated versus actual yield by hybrid, and organiser performance.

As a next step, I can build a clickable prototype of the mobile screens covering lot registration, the farm geo-fence, and stage entries. That would let you test it with field staff before development begins. Would that be useful, or would you prefer a detailed specification document for a development team first?
