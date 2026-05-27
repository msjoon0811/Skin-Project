import requests, json, sys

form = {
    "skinType": "복합성",
    "sensitivity": "자주",
    "concerns": ["건조함", "모공"],
    "drinking": "가끔 (월 1-2회)",
    "sleep": "5-6",
    "water": "부족 (<4잔)",
    "allergies": "",
}

r = requests.post(
    "http://localhost:8000/api/analyze",
    data={"form_data": json.dumps(form)},
    timeout=30,
)
result = r.json()
print("status:", r.status_code)
print("composite_score:", result.get("composite_score"))
print("skin_type_label:", result.get("skin_type_label"))
print("face_detected:", result.get("face_detected"))
print("ml_available:", result.get("ml_available"))
print("attributes:")
for a in result.get("attributes", []):
    print(f"  {a['name']:8} {a['value']:3}  {a['level']}  {a['desc']}")
print("rec:", [x["name"] for x in result.get("recommended_ingredients", [])])
print("avoid:", [x["name"] for x in result.get("avoid_ingredients", [])])
print("products:", len(result.get("products", [])))
print("explanation:", result.get("explanation"))
