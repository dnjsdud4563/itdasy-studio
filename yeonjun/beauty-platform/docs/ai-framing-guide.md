# AI Framing Guide - Medical Guideline Avoidance

> Apple App Store Guideline 1.4.1 Compliance Document
> App: Beauty Platform
> Last Updated: 2026-04-16

## Purpose

This document defines the language boundaries for all AI-generated content within the Beauty Platform app. Apple Guideline 1.4.1 prohibits apps from providing medical diagnoses or treatment recommendations unless they are registered medical devices. All AI skin analysis features must be framed as **educational and general information only**.

---

## Forbidden vs Allowed Phrase Mapping

| Category | FORBIDDEN (will cause rejection) | ALLOWED (compliant alternative) |
|---|---|---|
| Skin type diagnosis | "당신의 피부는 여드름성 피부입니다" | "이 유형의 피부 특성에 대한 일반 정보입니다" |
| Ingredient recommendation | "치료를 위해 이 성분을 사용하세요" | "일반적으로 알려진 화장품 성분 특징은..." |
| Health scoring | "건강 점수: 72점" | **FORBIDDEN - 종합 건강 점수 산출 금지** |
| Condition identification | "당신은 아토피 피부염 증상이 있습니다" | "이 이미지에서 관찰되는 일반적인 피부 특성 정보입니다" |
| Treatment plan | "이 루틴을 매일 따르세요" | "일반적으로 이 피부 유형에 참고할 수 있는 정보입니다" |
| Severity assessment | "심각한 피부 손상이 감지되었습니다" | "피부 고민이 있으시다면 전문의 상담을 권장합니다" |
| Medical terminology | "진단 결과" / "처방" / "치료" | "분석 참고 정보" / "추천 정보" / "관리 팁" |
| Prognosis | "2주 후 개선될 것입니다" | "일반적인 피부 관리에 대한 참고 정보입니다" |
| Drug/medication | "레티놀 0.5%를 처방합니다" | "레티놀은 일반적으로 알려진 화장품 성분입니다" |

---

## Absolute Prohibitions

The following features must NEVER be implemented regardless of framing:

1. **종합 건강 점수 산출** - No aggregate health scores (e.g., "건강 점수: 72점")
2. **질병 진단** - No disease diagnosis of any kind
3. **처방 추천** - No prescription drug recommendations
4. **의료 기기 연동** - No integration with medical devices without proper certification
5. **치료 효과 예측** - No prediction of treatment outcomes

---

## Mandatory Disclaimer

The following disclaimer MUST be displayed on every screen that shows AI analysis results. It must be visible without scrolling and cannot be hidden behind a toggle or "more info" button.

### Korean (Primary)

```
이 결과는 의료적 진단이 아니며, 전문의 상담을 대체하지 않습니다.
```

### English (Localized)

```
This result is not a medical diagnosis and does not replace professional medical consultation.
```

### UI Implementation Requirements

- **Font size**: Minimum 12pt (or equivalent in the design system)
- **Placement**: Directly below AI analysis results, above any action buttons
- **Color**: Must meet WCAG AA contrast ratio (4.5:1 minimum)
- **Persistence**: Cannot be dismissed, hidden, or collapsed by the user
- **Screen reader**: Must be included in the accessibility tree with `role="alert"`

---

## AI Response Template

All AI-generated skin analysis responses must follow this structure:

```
[일반 정보 헤더]
이미지에서 관찰된 피부 특성에 대한 일반 정보입니다.

[분석 참고 정보]
- 피부 유형 참고: {general_type_info}
- 관찰된 특성: {observed_characteristics}
- 일반 관리 정보: {general_care_info}

[면책 조항]
이 결과는 의료적 진단이 아니며, 전문의 상담을 대체하지 않습니다.
```

---

## Review Checklist for App Store Submission

- [ ] All AI output screens include the mandatory disclaimer
- [ ] No screen uses the word "진단" (diagnosis), "처방" (prescription), or "치료" (treatment)
- [ ] No aggregate health/skin score is computed or displayed
- [ ] AI feature descriptions in App Store metadata use "educational" and "general information" framing
- [ ] App Store screenshots do not contain any forbidden phrases
- [ ] Privacy policy references AI features as informational only

---

## References

- [Apple App Store Review Guidelines 1.4.1 - Physical Harm](https://developer.apple.com/app-store/review/guidelines/#physical-harm)
- [Apple Health & Medical Guidelines](https://developer.apple.com/app-store/review/guidelines/#health-and-health-research)
