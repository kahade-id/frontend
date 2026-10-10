// GENERATED from docs/api/kahade-api-mobile.json. Run npm run gen:api; do not edit.
export const API_CONSTRAINTS = {
  "AcceptOrderLinkDto": {
    "shippingAddressId": {
      "maxLength": 100
    }
  },
  "AddBankAccountDto": {
    "password": {
      "maxLength": 72
    },
    "mfaCode": {
      "maxLength": 16
    },
    "otpCode": {
      "maxLength": 10
    },
    "bankCode": {
      "enum": [
        "BCA",
        "BNI",
        "BRI",
        "MANDIRI",
        "CIMB",
        "PERMATA",
        "DANAMON",
        "OCBC",
        "PANIN",
        "MEGA",
        "BTN",
        "BSI",
        "MAYBANK",
        "OTHER"
      ]
    },
    "bankName": {
      "minLength": 2,
      "maxLength": 100
    },
    "accountNumber": {
      "pattern": "^\\d{6,20}$"
    },
    "accountName": {
      "minLength": 2,
      "maxLength": 100
    }
  },
  "AddCommentDto": {
    "content": {
      "minLength": 1,
      "maxLength": 1000
    }
  },
  "AddJastipItemDto": {
    "name": {
      "maxLength": 150
    },
    "note": {
      "maxLength": 300
    }
  },
  "AddReactionDto": {
    "emoji": {
      "maxLength": 16
    }
  },
  "AnswerQuestionDto": {
    "answer": {
      "minLength": 1,
      "maxLength": 2000
    }
  },
  "ApplyReferralDto": {
    "code": {
      "pattern": "^KH[A-Z0-9]{6,8}$"
    }
  },
  "AskQuestionDto": {
    "question": {
      "minLength": 5,
      "maxLength": 500
    }
  },
  "CalculateFeeDto": {
    "orderValue": {
      "minimum": 10000,
      "maximum": 1000000000
    },
    "feeResponsibility": {
      "enum": [
        "BUYER",
        "SELLER",
        "SPLIT"
      ]
    },
    "voucherCode": {
      "maxLength": 50
    },
    "role": {
      "enum": [
        "BUYER",
        "SELLER"
      ]
    }
  },
  "CallActionDto": {
    "callId": {
      "minLength": 1,
      "maxLength": 100
    }
  },
  "CancelOrderDto": {
    "reason": {
      "enum": [
        "CHANGED_MIND",
        "WRONG_DETAILS",
        "DUPLICATE_ORDER",
        "MUTUAL_AGREEMENT",
        "COUNTERPART_UNRESPONSIVE",
        "OTHER"
      ]
    },
    "note": {
      "maxLength": 500
    }
  },
  "ChangePasswordDto": {
    "currentPassword": {
      "maxLength": 72
    },
    "newPassword": {
      "minLength": 8,
      "maxLength": 72
    },
    "confirmPassword": {
      "minLength": 8,
      "maxLength": 72
    },
    "mfaCode": {
      "maxLength": 16
    }
  },
  "CleanupFilesDto": {
    "fileKeys": {
      "minItems": 1,
      "maxItems": 20
    }
  },
  "ConfirmDeliveryDto": {
    "proofId": {
      "pattern": "^c[a-z0-9]{24}$"
    }
  },
  "ConfirmOrderDto": {
    "action": {
      "enum": [
        "ACCEPT",
        "REJECT"
      ]
    },
    "reason": {
      "maxLength": 500
    },
    "shippingAddressId": {
      "maxLength": 100
    }
  },
  "ConfirmPhoneChangeDto": {
    "newPhoneNumber": {
      "maxLength": 20
    }
  },
  "ConfirmPhoneMigrationDto": {
    "deviceId": {
      "maxLength": 255
    }
  },
  "ConfirmSocialLinkDto": {
    "deviceId": {
      "maxLength": 255
    }
  },
  "ConfirmWithdrawOtpDto": {
    "otp": {
      "minLength": 6,
      "maxLength": 10
    }
  },
  "CorrectEmailDto": {
    "newEmail": {
      "maxLength": 254
    },
    "password": {
      "maxLength": 72
    },
    "mfaCode": {
      "maxLength": 16
    }
  },
  "CreateAddressDto": {
    "label": {
      "enum": [
        "RUMAH",
        "KANTOR",
        "LAINNYA"
      ]
    },
    "customLabel": {
      "maxLength": 40
    },
    "recipientName": {
      "maxLength": 100
    },
    "phone": {
      "maxLength": 20
    },
    "addressLine": {
      "maxLength": 300
    },
    "city": {
      "maxLength": 100
    },
    "province": {
      "maxLength": 100
    },
    "postalCode": {
      "maxLength": 10
    }
  },
  "CreateAgreementDto": {
    "text": {
      "maxLength": 5000
    }
  },
  "CreateConversationDto": {
    "source": {
      "enum": [
        "APP",
        "HELP_SITE"
      ]
    }
  },
  "CreateDigitalAssetDto": {
    "assetType": {
      "enum": [
        "FILE",
        "LINK",
        "LICENSE"
      ]
    },
    "label": {
      "maxLength": 120
    }
  },
  "CreateDmDto": {
    "username": {
      "maxLength": 30
    }
  },
  "CreateFeedbackDto": {
    "rating": {
      "minimum": 1,
      "maximum": 5
    },
    "appVersion": {
      "maxLength": 32
    }
  },
  "CreateHighlightDto": {
    "title": {
      "maxLength": 80
    }
  },
  "CreateInquiryDto": {
    "subject": {
      "maxLength": 200
    },
    "message": {
      "maxLength": 1000
    }
  },
  "CreateJastipTripDto": {
    "title": {
      "maxLength": 120
    }
  },
  "CreateOrderDto": {
    "role": {
      "enum": [
        "BUYER",
        "SELLER"
      ]
    },
    "counterpartUsername": {
      "minLength": 3,
      "maxLength": 30
    },
    "title": {
      "minLength": 3,
      "maxLength": 100
    },
    "description": {
      "minLength": 10,
      "maxLength": 500
    },
    "orderType": {
      "enum": [
        "PHYSICAL_GOODS",
        "DIGITAL_GOODS",
        "SERVICE",
        "OTHER"
      ]
    },
    "orderValue": {
      "minimum": 10000,
      "maximum": 1000000000
    },
    "deliveryDeadlineDays": {
      "minimum": 1,
      "maximum": 14
    },
    "feeResponsibility": {
      "enum": [
        "BUYER",
        "SELLER",
        "SPLIT"
      ]
    },
    "voucherCode": {
      "maxLength": 50
    },
    "shippingAddressId": {
      "maxLength": 100
    },
    "fulfillment": {
      "enum": [
        "BIASA",
        "PREORDER"
      ]
    },
    "participantMode": {
      "enum": [
        "SINGLE",
        "GROUP"
      ]
    },
    "category": {
      "enum": [
        "FISIK",
        "DIGITAL",
        "JASA"
      ]
    },
    "itemCondition": {
      "enum": [
        "baru",
        "bekas"
      ]
    },
    "conditionDescription": {
      "maxLength": 500
    },
    "deliveryMethod": {
      "enum": [
        "file",
        "kode",
        "akun",
        "lainnya"
      ]
    },
    "warrantyDays": {
      "minimum": 0
    },
    "deliverables": {
      "maxLength": 1000
    },
    "serviceLocation": {
      "maxLength": 200
    },
    "cancellationPolicy": {
      "maxLength": 1000
    },
    "slotId": {
      "maxLength": 100
    }
  },
  "CreateOrderFromChatDto": {
    "title": {
      "maxLength": 100
    },
    "description": {
      "maxLength": 500
    },
    "hargaSepakat": {
      "minimum": 1
    },
    "qty": {
      "minimum": 1
    },
    "role": {
      "enum": [
        "BUYER",
        "SELLER"
      ]
    },
    "orderType": {
      "enum": [
        "PHYSICAL_GOODS",
        "DIGITAL_GOODS",
        "SERVICE",
        "OTHER"
      ]
    },
    "deliveryDeadlineDays": {
      "minimum": 1,
      "maximum": 14
    },
    "feeResponsibility": {
      "enum": [
        "BUYER",
        "SELLER",
        "SPLIT"
      ]
    }
  },
  "CreateOrderLinkDto": {
    "role": {
      "enum": [
        "BUYER",
        "SELLER"
      ]
    },
    "title": {
      "minLength": 3,
      "maxLength": 100
    },
    "description": {
      "minLength": 10,
      "maxLength": 500
    },
    "orderType": {
      "enum": [
        "PHYSICAL_GOODS",
        "DIGITAL_GOODS",
        "SERVICE",
        "OTHER"
      ]
    },
    "orderValue": {
      "minimum": 10000,
      "maximum": 1000000000
    },
    "deliveryDeadlineDays": {
      "minimum": 1,
      "maximum": 14
    },
    "feeResponsibility": {
      "enum": [
        "BUYER",
        "SELLER",
        "SPLIT"
      ]
    },
    "counterpartUsername": {
      "maxLength": 30
    },
    "shippingAddressId": {
      "maxLength": 100
    },
    "showcaseId": {
      "maxLength": 64
    }
  },
  "CreatePatunganGroupDto": {
    "title": {
      "maxLength": 120
    },
    "mode": {
      "enum": [
        "BAGI_RATA",
        "CUSTOM"
      ]
    }
  },
  "CreatePollDto": {
    "question": {
      "maxLength": 300
    }
  },
  "CreateRatingDto": {
    "stars": {
      "minimum": 1,
      "maximum": 5
    },
    "comment": {
      "maxLength": 500
    }
  },
  "CreateReceiptTokenDto": {
    "kind": {
      "enum": [
        "WALLET_TX",
        "TRANSFER",
        "ORDER_PAYMENT",
        "TOPUP",
        "WITHDRAWAL"
      ]
    }
  },
  "CreateReplyTemplateDto": {
    "shortcut": {
      "maxLength": 32
    },
    "text": {
      "maxLength": 500
    }
  },
  "CreateScheduleDto": {
    "dayOfWeek": {
      "minimum": 0,
      "maximum": 6
    },
    "minAmount": {
      "minimum": 1
    },
    "pin": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "CreateSellerVoucherDto": {
    "voucherType": {
      "enum": [
        "FEE_DISCOUNT_FLAT",
        "FEE_DISCOUNT_PERCENT",
        "WALLET_CASHBACK",
        "TOPUP_BONUS"
      ]
    }
  },
  "CreateServiceSlotDto": {
    "note": {
      "maxLength": 200
    }
  },
  "CreateShowcaseCommentDto": {
    "content": {
      "maxLength": 1000
    }
  },
  "CreateShowcaseItemDto": {
    "title": {
      "maxLength": 100
    },
    "description": {
      "maxLength": 500
    },
    "descriptionHtml": {
      "maxLength": 10000
    },
    "category": {
      "maxLength": 60
    },
    "visibility": {
      "enum": [
        "PUBLIC",
        "PRIVATE"
      ]
    },
    "priceMin": {
      "minimum": 0,
      "maximum": 1000000000
    },
    "priceMax": {
      "minimum": 0,
      "maximum": 1000000000
    },
    "sortOrder": {
      "minimum": 0
    },
    "condition": {
      "enum": [
        "BARU",
        "BEKAS"
      ]
    }
  },
  "CreateStoryDto": {
    "kind": {
      "enum": [
        "image",
        "video",
        "text"
      ]
    },
    "mediaId": {
      "maxLength": 100
    },
    "text": {
      "maxLength": 200
    },
    "backgroundColor": {
      "pattern": "^#[0-9A-Fa-f]{6}$"
    },
    "productTags": {
      "maxItems": 5
    }
  },
  "CreateStoryHighlightDto": {
    "title": {
      "maxLength": 24
    },
    "storyIds": {
      "minItems": 1,
      "maxItems": 30
    }
  },
  "CreateTemplateDto": {
    "name": {
      "minLength": 1,
      "maxLength": 50
    },
    "title": {
      "minLength": 1,
      "maxLength": 200
    },
    "description": {
      "maxLength": 2000
    },
    "orderType": {
      "enum": [
        "PHYSICAL_GOODS",
        "DIGITAL_GOODS",
        "SERVICE",
        "OTHER"
      ]
    },
    "orderValue": {
      "minimum": 10000,
      "maximum": 1000000000
    },
    "feeResponsibility": {
      "enum": [
        "BUYER",
        "SELLER",
        "SPLIT"
      ]
    },
    "deliveryDeadlineDays": {
      "minimum": 1,
      "maximum": 14
    }
  },
  "DanaDirectPayDto": {
    "payKind": {
      "enum": [
        "QRIS",
        "VA",
        "BALANCE"
      ]
    }
  },
  "DeleteCommentDto": {
    "reason": {
      "maxLength": 500
    }
  },
  "DeletionCancelDto": {
    "cancelReason": {
      "maxLength": 500
    }
  },
  "DeletionStatusRequestDto": {
    "phoneNumber": {
      "maxLength": 20
    },
    "email": {
      "maxLength": 254
    }
  },
  "DeletionStatusVerifyDto": {
    "phoneNumber": {
      "maxLength": 20
    },
    "email": {
      "maxLength": 254
    },
    "otp": {
      "maxLength": 10
    }
  },
  "Disable2faDto": {
    "password": {
      "maxLength": 72
    },
    "code": {
      "minLength": 6,
      "maxLength": 16
    },
    "emailOtpCode": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "DisputeMessageDto": {
    "message": {
      "maxLength": 5000
    },
    "attachments": {
      "maxItems": 5
    }
  },
  "EditMessageDto": {
    "content": {
      "maxLength": 2000
    }
  },
  "Enable2faDto": {
    "code": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "EscalateDisputeDto": {
    "reason": {
      "maxLength": 2000
    }
  },
  "ForgotPasswordDto": {
    "identifier": {
      "maxLength": 20
    },
    "deviceId": {
      "maxLength": 255
    }
  },
  "ForwardMessageDto": {
    "targetRoomIds": {
      "maxItems": 5
    }
  },
  "HideContentDto": {
    "reason": {
      "enum": [
        "SPAM",
        "INAPPROPRIATE",
        "HARASSMENT",
        "OTHER"
      ]
    }
  },
  "InitChunkedUploadDto": {
    "purpose": {
      "enum": [
        "KYC_KTP",
        "KYC_SELFIE",
        "KYC_PASSPORT",
        "KYC_LIVENESS",
        "BUSINESS_DOCUMENT",
        "SHOWCASE_IMAGE",
        "SHOWCASE_VIDEO",
        "STORY_MEDIA",
        "STORY_HIGHLIGHT",
        "AVATAR",
        "DIGITAL_ASSET",
        "CHAT_ATTACHMENT",
        "DISPUTE_EVIDENCE",
        "REPORT_EVIDENCE",
        "DELIVERY_PROOF",
        "MILESTONE_EVIDENCE",
        "CAREER_CV"
      ]
    },
    "fileName": {
      "maxLength": 255
    },
    "mimeType": {
      "maxLength": 100
    }
  },
  "JoinJastipDto": {
    "itemSummary": {
      "maxLength": 300
    }
  },
  "LinkSocialProviderDto": {
    "provider": {
      "enum": [
        "google",
        "apple"
      ]
    }
  },
  "LoginDto": {
    "identifier": {
      "maxLength": 254
    },
    "password": {
      "maxLength": 72
    },
    "deviceId": {
      "maxLength": 255
    },
    "deviceInfo": {
      "maxLength": 512
    }
  },
  "MuteRoomDto": {
    "durationHours": {
      "minimum": 1,
      "maximum": 720
    }
  },
  "MutualResolutionProposeDto": {
    "buyerPercent": {
      "minimum": 0,
      "maximum": 100
    },
    "sellerPercent": {
      "minimum": 0,
      "maximum": 100
    },
    "reason": {
      "minLength": 10,
      "maxLength": 2000
    }
  },
  "MutualResolutionRespondDto": {
    "action": {
      "enum": [
        "ACCEPT",
        "REJECT"
      ]
    },
    "responseNote": {
      "maxLength": 2000
    }
  },
  "PasskeyAuthVerifyDto": {
    "deviceId": {
      "maxLength": 255
    }
  },
  "PasskeyReauthDto": {
    "password": {
      "maxLength": 72
    },
    "mfaCode": {
      "maxLength": 16
    },
    "otpCode": {
      "maxLength": 10
    }
  },
  "PasskeyRecoverDto": {
    "step": {
      "enum": [
        "request",
        "verify"
      ]
    },
    "otpCode": {
      "maxLength": 10
    },
    "deviceId": {
      "maxLength": 255
    }
  },
  "PasskeyRegisterOptionsDto": {
    "password": {
      "maxLength": 72
    },
    "mfaCode": {
      "maxLength": 16
    },
    "otpCode": {
      "maxLength": 10
    },
    "deviceName": {
      "maxLength": 100
    }
  },
  "PasskeyRegisterVerifyDto": {
    "deviceName": {
      "maxLength": 100
    }
  },
  "PasskeyRenameDto": {
    "password": {
      "maxLength": 72
    },
    "mfaCode": {
      "maxLength": 16
    },
    "otpCode": {
      "maxLength": 10
    },
    "deviceName": {
      "maxLength": 100
    }
  },
  "PasskeyRevokeDto": {
    "password": {
      "maxLength": 72
    },
    "mfaCode": {
      "maxLength": 16
    },
    "otpCode": {
      "maxLength": 10
    }
  },
  "PhoneRegisterDto": {
    "fullName": {
      "minLength": 2,
      "maxLength": 60
    },
    "username": {
      "minLength": 3,
      "maxLength": 30
    },
    "password": {
      "minLength": 8,
      "maxLength": 72
    },
    "referralCode": {
      "maxLength": 20
    },
    "deviceId": {
      "maxLength": 255
    }
  },
  "PresignedUrlDto": {
    "purpose": {
      "enum": [
        "KYC_KTP",
        "KYC_SELFIE",
        "KYC_PASSPORT",
        "KYC_LIVENESS",
        "BUSINESS_DOCUMENT",
        "SHOWCASE_IMAGE",
        "SHOWCASE_VIDEO",
        "STORY_MEDIA",
        "STORY_HIGHLIGHT",
        "AVATAR",
        "DIGITAL_ASSET",
        "CHAT_ATTACHMENT",
        "DISPUTE_EVIDENCE",
        "REPORT_EVIDENCE",
        "DELIVERY_PROOF",
        "MILESTONE_EVIDENCE",
        "CAREER_CV"
      ]
    }
  },
  "QaAppealDto": {
    "targetType": {
      "enum": [
        "QUESTION",
        "COMMENT"
      ]
    },
    "reason": {
      "minLength": 10,
      "maxLength": 1000
    }
  },
  "QaReportDto": {
    "reasonCode": {
      "enum": [
        "SPAM",
        "PROFANITY",
        "HARASSMENT",
        "PII_LEAK",
        "SCAM_SUSPECTED",
        "OFF_TOPIC",
        "OTHER"
      ]
    },
    "note": {
      "maxLength": 500
    }
  },
  "RatingReplyDto": {
    "content": {
      "maxLength": 500
    }
  },
  "RecordSearchDto": {
    "keyword": {
      "maxLength": 80
    }
  },
  "RegenerateBackupCodesDto": {
    "password": {
      "maxLength": 72
    },
    "code": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "RegisterDeviceDto": {
    "token": {
      "maxLength": 512
    },
    "platform": {
      "enum": [
        "android",
        "ios",
        "web"
      ]
    },
    "deviceId": {
      "maxLength": 128
    }
  },
  "RejectDeliveryDto": {
    "note": {
      "minLength": 10,
      "maxLength": 1000
    },
    "proofId": {
      "pattern": "^c[a-z0-9]{24}$"
    }
  },
  "RenewDanaDto": {
    "payKind": {
      "enum": [
        "QRIS",
        "VA",
        "BALANCE"
      ]
    }
  },
  "ReplyTicketDto": {
    "message": {
      "minLength": 1,
      "maxLength": 5000
    }
  },
  "ReplyToStoryDto": {
    "text": {
      "maxLength": 200
    }
  },
  "ReportRoomDto": {
    "category": {
      "enum": [
        "FRAUD",
        "FAKE_IDENTITY",
        "INAPPROPRIATE_CONTENT",
        "TNC_VIOLATION",
        "MONEY_LAUNDERING",
        "SPAM",
        "OTHER"
      ]
    },
    "description": {
      "minLength": 20,
      "maxLength": 500
    }
  },
  "ReportShowcaseDto": {
    "reason": {
      "minLength": 3,
      "maxLength": 100
    },
    "description": {
      "maxLength": 1000
    }
  },
  "ReportStoryDto": {
    "category": {
      "enum": [
        "spam",
        "harassment",
        "offensive",
        "irrelevant",
        "other"
      ]
    },
    "note": {
      "maxLength": 500
    }
  },
  "ReportUserDto": {
    "category": {
      "enum": [
        "FRAUD",
        "FAKE_IDENTITY",
        "INAPPROPRIATE_CONTENT",
        "TNC_VIOLATION",
        "MONEY_LAUNDERING",
        "SPAM",
        "OTHER"
      ]
    },
    "description": {
      "minLength": 20,
      "maxLength": 500
    }
  },
  "ReportUserSettingsDto": {
    "category": {
      "enum": [
        "FRAUD",
        "FAKE_IDENTITY",
        "INAPPROPRIATE_CONTENT",
        "TNC_VIOLATION",
        "MONEY_LAUNDERING",
        "SPAM",
        "OTHER"
      ]
    },
    "description": {
      "minLength": 20,
      "maxLength": 500
    },
    "evidenceUrls": {
      "maxItems": 10
    }
  },
  "RequestAccountDeletionDto": {
    "reason": {
      "maxLength": 1000
    },
    "mfaCode": {
      "maxLength": 16
    },
    "otpCode": {
      "maxLength": 10
    }
  },
  "RequestExtensionDto": {
    "extensionDays": {
      "minimum": 1,
      "maximum": 14
    },
    "reason": {
      "minLength": 10,
      "maxLength": 500
    }
  },
  "RequestOtpTriggerDto": {
    "phoneNumber": {
      "maxLength": 20
    },
    "deviceId": {
      "maxLength": 255
    },
    "purpose": {
      "enum": [
        "register",
        "login",
        "forgot_password",
        "migrate_phone"
      ]
    }
  },
  "RequestPhoneChangeDto": {
    "newPhoneNumber": {
      "maxLength": 20
    },
    "method": {
      "enum": [
        "SMS",
        "WHATSAPP"
      ]
    },
    "currentPassword": {
      "minLength": 1,
      "maxLength": 256
    },
    "mfaCode": {
      "maxLength": 16
    }
  },
  "ResendVerificationDto": {
    "email": {
      "maxLength": 254
    }
  },
  "ResetPasswordDto": {
    "deviceId": {
      "maxLength": 255
    },
    "newPassword": {
      "minLength": 8,
      "maxLength": 72
    },
    "confirmPassword": {
      "minLength": 8,
      "maxLength": 72
    }
  },
  "RespondExtensionDto": {
    "action": {
      "enum": [
        "APPROVE",
        "REJECT"
      ]
    },
    "note": {
      "maxLength": 500
    }
  },
  "SendMessageDto": {
    "messageType": {
      "enum": [
        "TEXT",
        "IMAGE",
        "FILE",
        "VIDEO",
        "VOICE",
        "LOCATION",
        "PRODUCT_CARD",
        "ORDER_CARD"
      ]
    },
    "content": {
      "maxLength": 2000
    },
    "durationSeconds": {
      "minimum": 1,
      "maximum": 600
    },
    "caption": {
      "maxLength": 500
    },
    "ephemeralTtlSeconds": {
      "minimum": 5,
      "maximum": 604800
    }
  },
  "SetCommentHiddenDto": {
    "reason": {
      "enum": [
        "SPAM",
        "INAPPROPRIATE",
        "HARASSMENT",
        "OTHER"
      ]
    }
  },
  "SetPinDto": {
    "pin": {
      "minLength": 6,
      "maxLength": 6
    },
    "currentPin": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "SetStoryReactionDto": {
    "emoji": {
      "enum": [
        "❤️",
        "😂",
        "😮",
        "😢",
        "👏",
        "🔥"
      ]
    }
  },
  "SetUsernameDto": {
    "username": {
      "minLength": 3,
      "maxLength": 30
    }
  },
  "Setup2faDto": {
    "password": {
      "maxLength": 72
    }
  },
  "SocialLoginDto": {
    "provider": {
      "enum": [
        "google",
        "apple"
      ]
    },
    "deviceId": {
      "maxLength": 255
    }
  },
  "SubmitBusinessVerificationDto": {
    "businessName": {
      "minLength": 3,
      "maxLength": 150
    },
    "deedNumber": {
      "maxLength": 100
    },
    "siupNumber": {
      "maxLength": 100
    }
  },
  "SubmitClaimDto": {
    "claim": {
      "minLength": 20,
      "maxLength": 5000
    }
  },
  "SubmitDeliveryProofDto": {
    "description": {
      "minLength": 10,
      "maxLength": 2000
    },
    "fileUrls": {
      "maxItems": 10
    },
    "linkUrls": {
      "maxItems": 5
    }
  },
  "SubmitDisputeDto": {
    "category": {
      "enum": [
        "ITEM_NOT_RECEIVED",
        "ITEM_NOT_AS_DESCRIBED",
        "DAMAGED_ITEM",
        "WRONG_ITEM",
        "SERVICE_NOT_RENDERED",
        "PAYMENT_ISSUE",
        "FRAUD",
        "OTHER"
      ]
    },
    "claim": {
      "minLength": 20,
      "maxLength": 2000
    },
    "fileUrls": {
      "minItems": 0,
      "maxItems": 10
    },
    "fileTypes": {
      "maxItems": 10
    }
  },
  "SubmitEvidenceDto": {
    "description": {
      "maxLength": 2000
    },
    "fileUrls": {
      "minItems": 1,
      "maxItems": 10
    },
    "fileTypes": {
      "minItems": 1,
      "maxItems": 10
    }
  },
  "SubmitKycDto": {
    "documentType": {
      "enum": [
        "KTP",
        "PASSPORT"
      ]
    }
  },
  "SubscribeDanaDto": {
    "plan": {
      "enum": [
        "MONTHLY",
        "YEARLY"
      ]
    },
    "payKind": {
      "enum": [
        "QRIS",
        "VA",
        "BALANCE"
      ]
    }
  },
  "SubscribeDto": {
    "plan": {
      "enum": [
        "MONTHLY",
        "YEARLY"
      ]
    },
    "paymentMethod": {
      "enum": [
        "VIRTUAL_ACCOUNT_BCA",
        "VIRTUAL_ACCOUNT_BNI",
        "VIRTUAL_ACCOUNT_BRI",
        "VIRTUAL_ACCOUNT_MANDIRI",
        "VIRTUAL_ACCOUNT_CIMB",
        "VIRTUAL_ACCOUNT_PERMATA",
        "VIRTUAL_ACCOUNT_OTHER",
        "QRIS",
        "GOPAY",
        "SHOPEEPAY",
        "OVO",
        "DANA",
        "LINKAJA",
        "CREDIT_CARD",
        "ALFAMART",
        "INDOMARET",
        "AKULAKU",
        "KREDIVO",
        "KAHADE_WALLET"
      ]
    }
  },
  "ToggleCommentLikeDto": {
    "value": {
      "enum": [
        1,
        -1,
        0
      ]
    }
  },
  "TopupDto": {
    "amount": {
      "minimum": 10000,
      "maximum": 50000000
    },
    "method": {
      "enum": [
        "VIRTUAL_ACCOUNT_BCA",
        "VIRTUAL_ACCOUNT_BNI",
        "VIRTUAL_ACCOUNT_BRI",
        "VIRTUAL_ACCOUNT_MANDIRI",
        "VIRTUAL_ACCOUNT_CIMB",
        "VIRTUAL_ACCOUNT_PERMATA",
        "VIRTUAL_ACCOUNT_OTHER",
        "QRIS",
        "GOPAY",
        "SHOPEEPAY",
        "OVO",
        "DANA",
        "LINKAJA",
        "CREDIT_CARD",
        "ALFAMART",
        "INDOMARET",
        "AKULAKU",
        "KREDIVO"
      ]
    }
  },
  "TransferDto": {
    "amount": {
      "minimum": 1000,
      "maximum": 25000000
    }
  },
  "TranslateMessageDto": {
    "targetLang": {
      "maxLength": 10
    }
  },
  "TrustDeviceDto": {
    "password": {
      "minLength": 1,
      "maxLength": 128
    },
    "mfaCode": {
      "maxLength": 16
    }
  },
  "UpdateAddressDto": {
    "label": {
      "enum": [
        "RUMAH",
        "KANTOR",
        "LAINNYA"
      ]
    },
    "customLabel": {
      "maxLength": 40
    },
    "recipientName": {
      "maxLength": 100
    },
    "phone": {
      "maxLength": 20
    },
    "addressLine": {
      "maxLength": 300
    },
    "city": {
      "maxLength": 100
    },
    "province": {
      "maxLength": 100
    },
    "postalCode": {
      "maxLength": 10
    }
  },
  "UpdateBankAccountDto": {
    "password": {
      "maxLength": 72
    },
    "mfaCode": {
      "maxLength": 16
    },
    "otpCode": {
      "maxLength": 10
    },
    "accountName": {
      "minLength": 2,
      "maxLength": 100
    }
  },
  "UpdateChatPrivacyDto": {
    "dmPolicy": {
      "enum": [
        "EVERYONE",
        "FOLLOWING",
        "NONE"
      ]
    }
  },
  "UpdateConsentDto": {
    "type": {
      "enum": [
        "MARKETING_PUSH",
        "MARKETING_EMAIL",
        "MARKETING_WHATSAPP",
        "TRANSACTIONAL"
      ]
    }
  },
  "UpdateHighlightDto": {
    "title": {
      "maxLength": 80
    }
  },
  "UpdateLanguageDto": {
    "language": {
      "enum": [
        "id",
        "en"
      ]
    }
  },
  "UpdatePreferencesDto": {
    "language": {
      "enum": [
        "id",
        "en"
      ]
    },
    "digestFrequency": {
      "enum": [
        "off",
        "daily",
        "weekly"
      ]
    }
  },
  "UpdatePrivacyDto": {
    "showFollowerList": {
      "enum": [
        "EVERYONE",
        "FOLLOWERS",
        "ONLY_ME"
      ]
    },
    "showFollowingList": {
      "enum": [
        "EVERYONE",
        "FOLLOWERS",
        "ONLY_ME"
      ]
    },
    "showcaseDefaultVisibility": {
      "enum": [
        "PUBLIC",
        "PRIVATE"
      ]
    },
    "qaCommentPolicy": {
      "enum": [
        "EVERYONE",
        "FOLLOWERS",
        "DISABLED"
      ]
    }
  },
  "UpdateProductCommerceDto": {
    "productType": {
      "enum": [
        "JASA",
        "FISIK",
        "DIGITAL",
        "LAINNYA"
      ]
    }
  },
  "UpdateProfileDto": {
    "fullName": {
      "minLength": 2,
      "maxLength": 60
    },
    "username": {
      "minLength": 3,
      "maxLength": 30
    },
    "bio": {
      "minLength": 0,
      "maxLength": 160
    }
  },
  "UpdateRatingDto": {
    "stars": {
      "minimum": 1,
      "maximum": 5
    },
    "comment": {
      "maxLength": 500
    }
  },
  "UpdateReplyTemplateDto": {
    "shortcut": {
      "maxLength": 32
    },
    "text": {
      "maxLength": 500
    }
  },
  "UpdateScheduleDto": {
    "dayOfWeek": {
      "minimum": 0,
      "maximum": 6
    },
    "minAmount": {
      "minimum": 1
    },
    "pin": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "UpdateShippingDto": {
    "trackingNumber": {
      "minLength": 3,
      "maxLength": 100
    },
    "courierName": {
      "minLength": 2,
      "maxLength": 100
    },
    "trackingNotes": {
      "maxLength": 500
    }
  },
  "UpdateShowcaseCommentDto": {
    "content": {
      "maxLength": 1000
    }
  },
  "UpdateShowcaseItemDto": {
    "title": {
      "maxLength": 100
    },
    "description": {
      "maxLength": 500
    },
    "descriptionHtml": {
      "maxLength": 10000
    },
    "category": {
      "maxLength": 60
    },
    "visibility": {
      "enum": [
        "PUBLIC",
        "PRIVATE"
      ]
    },
    "priceMin": {
      "minimum": 0,
      "maximum": 1000000000
    },
    "priceMax": {
      "minimum": 0,
      "maximum": 1000000000
    },
    "sortOrder": {
      "minimum": 0
    },
    "condition": {
      "enum": [
        "BARU",
        "BEKAS"
      ]
    }
  },
  "UpdateStoryHighlightDto": {
    "title": {
      "maxLength": 24
    },
    "storyIds": {
      "minItems": 1,
      "maxItems": 30
    }
  },
  "UpdateTemplateDto": {
    "name": {
      "minLength": 1,
      "maxLength": 50
    },
    "title": {
      "minLength": 1,
      "maxLength": 200
    },
    "description": {
      "maxLength": 2000
    },
    "orderType": {
      "enum": [
        "PHYSICAL_GOODS",
        "DIGITAL_GOODS",
        "SERVICE",
        "OTHER"
      ]
    },
    "orderValue": {
      "minimum": 10000,
      "maximum": 1000000000
    },
    "feeResponsibility": {
      "enum": [
        "BUYER",
        "SELLER",
        "SPLIT"
      ]
    },
    "deliveryDeadlineDays": {
      "minimum": 1,
      "maximum": 14
    }
  },
  "ValidateCounterpartDto": {
    "username": {
      "minLength": 3,
      "maxLength": 50
    }
  },
  "ValidateVoucherDto": {
    "code": {
      "maxLength": 30
    },
    "orderValue": {
      "minimum": 1
    },
    "userRole": {
      "enum": [
        "BUYER",
        "SELLER"
      ]
    }
  },
  "Verify2faLoginDto": {
    "tempToken": {
      "maxLength": 512
    },
    "code": {
      "minLength": 6,
      "maxLength": 16
    },
    "deviceId": {
      "maxLength": 255
    },
    "deviceInfo": {
      "maxLength": 512
    }
  },
  "VerifyEmailDto": {
    "email": {
      "maxLength": 254
    },
    "otp": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "VerifyPhoneOtpDto": {
    "phoneNumber": {
      "maxLength": 20
    },
    "deviceId": {
      "maxLength": 255
    },
    "deviceInfo": {
      "maxLength": 512
    }
  },
  "VerifyPinDto": {
    "pin": {
      "minLength": 6,
      "maxLength": 6
    }
  },
  "WithdrawDto": {
    "amount": {
      "minimum": 50000,
      "maximum": 25000000
    }
  }
} as const
