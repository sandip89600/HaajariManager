import json
import os

new_keys = {
  "profile": {
    "title": "User Profile",
    "editProfile": "Edit Profile",
    "fullName": "Full Name",
    "email": "Email Address",
    "mobile": "Mobile Number",
    "company": "Company Name",
    "address": "Address",
    "avatarColor": "Avatar Color",
    "saveChanges": "Save Changes",
    "updating": "Updating profile...",
    "success": "Profile updated successfully",
    "error": "Failed to update profile",
    "plan": "Current Plan",
    "upgrade": "Upgrade Plan",
    "accountInfo": "Account Information",
    "businessAddress": "Business Address",
    "memberSince": "Member Since",
    "userId": "User ID",
    "notProvided": "Not Provided",
    "changePassword": "Change Password",
    "oldPassword": "Old Password",
    "newPassword": "New Password",
    "confirmPassword": "Confirm Password",
    "passwordMismatch": "Passwords do not match",
    "passwordSuccess": "Password changed successfully",
    "passwordError": "Failed to change password",
    "camera": "Take Photo",
    "library": "Choose from Library",
    "removePhoto": "Remove Photo",
    "editAvatar": "Edit Profile Picture",
    "uploadSuccess": "Profile picture updated successfully",
    "uploadError": "Failed to update profile picture on server",
    "offlineSuccess": "Profile picture saved locally.",
    "cameraPermission": "Camera permission is required to take photos",
    "libraryPermission": "Photo library permission is required",
    "permissionDenied": "Permission Denied",
    "removeSuccess": "Profile picture removed",
    "removeError": "Failed to remove profile picture",
    "removeOfflineSuccess": "Profile picture removed locally",
    "deleteAccountTitle": "Delete Account",
    "deleteAccountConfirm": "Are you sure? This action is PERMANENT. All your data (workers, attendance, payments, projects) will be deleted from the server and cannot be recovered.",
    "deleteAccountBtn": "Delete Permanently",
    "deleteAccountError": "Failed to delete account. Please try again.",
    "removeConfirm": "Remove profile picture?",
    "errorEmail": "Please enter a valid email address",
    "passwordLength": "Password must be at least 6 characters",
    "errorFieldsRequired": "Name and Phone are required",
    "contractor": "Contractor",
    "builder": "Builder",
    "supervisor": "Supervisor",
    "admin": "Administrator"
  },
  "project": {
    "title": "Project List",
    "addProject": "Add Project",
    "editProject": "Edit Project",
    "projectName": "Project/Site Name",
    "projectNamePlaceholder": "e.g. Metro Heights Phase 1",
    "description": "Description",
    "location": "Location / Address",
    "locationPlaceholder": "e.g. Sector 62, Noida",
    "status": "Status",
    "active": "Active",
    "completed": "Completed",
    "noProjects": "No projects created yet. Add your first construction site.",
    "addFirst": "Tap + to add your first project",
    "confirmDeleteTitle": "Confirm Delete",
    "confirmDeleteMessage": "Are you sure you want to delete this project? Associated workers will be unassigned.",
    "deleteProject": "Delete Project",
    "successDelete": "Project deleted successfully.",
    "errorDelete": "Failed to delete project",
    "errorSave": "Failed to save project",
    "errorStatus": "Failed to update project status",
    "errorLoad": "Failed to load projects",
    "projectNameRequired": "Please enter project name",
    "professionalTitle": "Upgrade to Professional Plan",
    "professionalDesc": "The Free plan is limited to 1 active project. Upgrade to create multiple projects, assign unlimited workers, and access GPS features.",
    "viewUpgradePlans": "View Upgrade Plans",
    "notNow": "Not Now"
  },
  "device": {
    "title": "Device Management",
    "trustedDevices": "Trusted Devices & Active Sessions",
    "currentDevice": "Current Device",
    "lastActive": "Last Active",
    "logoutDevice": "Log out from this device",
    "logoutAll": "Logout All",
    "suspicious": "Suspicious Activity Detected",
    "ip": "IP Address",
    "browser": "Browser",
    "os": "Operating System",
    "noActiveSessions": "No active device sessions found.",
    "recentLoginHistory": "Recent Login History",
    "noHistory": "No login history logged yet.",
    "revokeSession": "Revoke Session",
    "revokeConfirm": "Are you sure you want to log out and remove the device \"{deviceName}\"?",
    "logoutAllConfirm": "Are you sure you want to force log out and invalidate sessions on all other devices?",
    "logoutAllTitle": "Log Out All Devices",
    "logoutAllButton": "Log Out All",
    "successRevoke": "Device revoked successfully.",
    "errorRevoke": "Failed to revoke device session.",
    "successLogoutAll": "Successfully logged out from all other devices.",
    "errorLogoutAll": "Failed to perform action.",
    "loggedIn": "Logged In",
    "loggedOut": "Logged Out"
  },
  "privacy": {
    "title": "Privacy Settings",
    "profileVisibility": "Profile Visibility",
    "public": "Public",
    "publicDesc": "Everyone can see your profile details and company info",
    "private": "Private",
    "privateDesc": "Only approved team members can see your profile",
    "attendanceVisibility": "Attendance Visibility",
    "onlyMe": "Only Me",
    "onlyMeDesc": "Keep attendance metrics fully private to your account",
    "supervisors": "Supervisors",
    "supervisorsDesc": "Allow assigned supervisors to view project attendance",
    "companyAdmin": "Company Admin",
    "companyAdminDesc": "Make logs visible to root company administrators",
    "analyticsSharing": "Analytics Sharing",
    "allowAnalytics": "Allow anonymous analytics",
    "analyticsDesc": "Help us improve HAI by sharing diagnostic data anonymously",
    "notifications": "Notification Alerts",
    "attendanceAlerts": "Attendance Alerts",
    "attendanceAlertsDesc": "Notify when supervisors mark daily attendance",
    "salaryAlerts": "Salary Alerts",
    "salaryAlertsDesc": "Notify when monthly payroll logs are calculated",
    "appUpdates": "App Updates",
    "appUpdatesDesc": "Notify about new security modules and feature updates",
    "accountSecurity": "Account Security Logging",
    "loginActivity": "Login Activity Tracking",
    "loginActivityDesc": "Log date, time, and operating system of login events",
    "deviceTracking": "Device Tracking",
    "deviceTrackingDesc": "Keep a record of active trusted devices and browsers",
    "saveChanges": "Save Changes",
    "saveSuccess": "Privacy settings updated successfully.",
    "saveError": "Failed to update settings. Please try again."
  },
  "supervisor": {
    "title": "Supervisors",
    "addSupervisor": "Add Supervisor",
    "editSupervisor": "Edit Supervisor",
    "inviteSupervisor": "Invite Supervisor",
    "name": "Supervisor Name",
    "namePlaceholder": "e.g. Ramesh Kumar",
    "phone": "Mobile Number",
    "phonePlaceholder": "e.g. 9876543210",
    "password": "Password",
    "passwordNewPlaceholder": "New Password (Optional)",
    "passwordPlaceholder": "e.g. 123456",
    "passwordEditPlaceholder": "Leave blank to keep current",
    "assignedProjects": "Assigned Projects:",
    "assignConstruction": "Assign to Construction Sites",
    "createProjectFirst": "Please create a project site first.",
    "noSupervisors": "No supervisor accounts added. Create supervisors to delegate attendance marking.",
    "confirmDeleteTitle": "Confirm Delete",
    "confirmDeleteMessage": "Are you sure you want to delete this supervisor account? They will lose access to mark attendance immediately.",
    "deleteAccount": "Delete Account",
    "errorFetch": "Failed to fetch supervisors or projects",
    "errorNameRequired": "Name is required",
    "errorPhoneInvalid": "Please enter a valid 10-digit mobile number",
    "errorPasswordRequired": "Password is required for new supervisors",
    "errorUpdate": "Failed to update supervisor",
    "errorCreate": "Failed to create supervisor",
    "errorDelete": "Failed to delete supervisor account",
    "errorStatus": "Failed to update supervisor status",
    "errorConnect": "Could not connect to server",
    "errorServer": "Server unreachable",
    "upgradeTitle": "Upgrade Subscription",
    "upgradeFree": "Supervisor accounts are not available on the Free Plan. Upgrade to a Professional or Business Plan to invite supervisors.",
    "upgradeProfessional": "You have reached the limit of 2 supervisor accounts on the Professional Plan. Upgrade to the Business Plan to unlock unlimited supervisors.",
    "viewPricingPlans": "View Pricing Plans",
    "notNow": "Not Now"
  },
  "support": {
    "title": "Support & Help Center",
    "contactUs": "We're here to assist you. Choose your preferred way of contacting us below.",
    "faqs": "Frequently Asked Questions",
    "feedback": "Submit Feedback",
    "feedbackPlaceholder": "Write your suggestions here...",
    "reportProblem": "Report a Problem",
    "terms": "Terms & Conditions",
    "privacyPolicy": "Privacy Policy",
    "whatsappTitle": "WhatsApp Support",
    "whatsappDesc": "Chat directly with our support team for quick answers regarding attendance, payments, or setting up your account.",
    "whatsappButton": "Start WhatsApp Chat",
    "emailTitle": "Email Support",
    "emailDesc": "Send us your detailed queries or attachments, and our tech team will resolve your issue promptly.",
    "emailButton": "Send Support Email",
    "whatsappAlert": "WhatsApp is not installed on this device.",
    "emailAlert": "Could not open email client."
  },
  "admin": {
    "dashboard": "HAI Control Center",
    "users": "User Accounts",
    "activeUsers": "Active Users",
    "revenue": "Total Revenue",
    "subscriptions": "Premium Subscriptions",
    "logs": "System Logs",
    "analytics": "Platform Analytics",
    "search": "Search user accounts...",
    "status": "Account Status",
    "suspend": "Suspend Account",
    "activate": "Activate Account",
    "loginTitle": "HAI Admin",
    "subtitle": "System Administration Control Panel",
    "usernameLabel": "Username",
    "usernamePlaceholder": "Enter admin username",
    "passwordLabel": "Password",
    "passwordPlaceholder": "Enter admin password",
    "signIn": "Sign In",
    "errorFields": "Please fill all fields",
    "errorCredentials": "Invalid Username or Password",
    "errorServer": "Network error: Backend server unreachable",
    "dashboardTab": "Dashboard",
    "usersTab": "Users",
    "liveSocket": "Live Socket Link Active",
    "socketConnecting": "Socket Server Connecting...",
    "payments": "Payments"
  }
}

languages = {
    "en": {"name": "English", "app_name": "HAI", "tagline": "Powered by Haajari Artificial Intelligence", "attendance": "Attendance", "workers": "Workers", "summary": "Summary", "settings": "Settings", "save": "Save", "cancel": "Cancel", "delete": "Delete", "edit": "Edit", "present": "P", "absent": "A"},
    "hi": {"name": "हिन्दी (Hindi)", "app_name": "HAI", "tagline": "हाजरी आर्टिफिशियल इंटेलिजेंस द्वारा संचालित", "attendance": "हाजरी", "workers": "कामगार", "summary": "सारांश", "settings": "सेटिंग्स", "save": "सुरक्षित करें", "cancel": "रद्द करें", "delete": "हटाएं", "edit": "संपादित करें", "present": "उ", "absent": "ग"},
    "bn": {"name": "বাংলা (Bengali)", "app_name": "HAI", "tagline": "হাজরি কৃত্রিম বুদ্ধিমত্তা দ্বারা চালিত", "attendance": "হাজিরা", "workers": "কর্মী", "summary": "সারসংক্ষেপ", "settings": "সেটিংস", "save": "সংরক্ষণ", "cancel": "বাতিল", "delete": "মুছে ফেলুন", "edit": "সম্পাদনা", "present": "উ", "absent": "অনুপ"},
    "te": {"name": "తెలుగు (Telugu)", "app_name": "HAI", "tagline": "హాజరు కృత్రిమ మేధస్సుతో పనిచేస్తుంది", "attendance": "హాజరు", "workers": "కార్మికులు", "summary": "సారాంశం", "settings": "సెట్టింగులు", "save": "சேவ்", "cancel": "రద్దు", "delete": "తొలగించు", "edit": "సవరించు", "present": "హా", "absent": "గే"},
    "mr": {"name": "मराठी (Marathi)", "app_name": "HAI", "tagline": "हाजरी आर्टिफिशियल इंटेलिजन्सद्वारे संचालित", "attendance": "हजेरी", "workers": "कामगार", "summary": "सारांश", "settings": "सेटिंग्ज", "save": "जतन करा", "cancel": "रद्द करा", "delete": "काढून टाका", "edit": "संपादन", "present": "ह", "absent": "गै"},
    "ta": {"name": "தமிழ் (Tamil)", "app_name": "HAI", "tagline": "ஹாஜரி செயற்கை நுண்ணறிவு மூலம் இயக்கப்படுகிறது", "attendance": "வருகை", "workers": "தொழிலாளர்கள்", "summary": "சுருக்கம்", "settings": "அமைப்புகள்", "save": "சேமி", "cancel": "ரத்து", "delete": "அழி", "edit": "திருத்து", "present": "வ", "absent": "இ"},
    "gu": {"name": "ગુજરાતી (Gujarati)", "app_name": "HAI", "tagline": "હાજરી કૃત્રિમ બુદ્ધિમત્તા દ્વારા સંચાલિત", "attendance": "હાજરી", "workers": "કામદારો", "summary": "સારાંશ", "settings": "સેટિંગ્સ", "save": "સાચવો", "cancel": "રદ કરો", "delete": "કાઢી નાખો", "edit": "ફેરફાર કરો", "present": "હા", "absent": "ગેર"},
    "kn": {"name": "ಕನ್ನಡ (Kannada)", "app_name": "HAI", "tagline": "ಹಾಜರಾತಿ ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆಯಿಂದ ಚಾಲಿತವಾಗಿದೆ", "attendance": "ಹಾಜರಾತಿ", "workers": "ಕಾರ್ಮಿಕರು", "summary": "ಸಾರಾಂಶ", "settings": "ಸೆಟ್ಟಿಂಗ್‌ಗಳು", "save": "ಉಳಿಸು", "cancel": "ರದ್ದು", "delete": "ಅಳಿಸು", "edit": "ಮಾರ್ಪಡಿಸು", "present": "ಹಾ", "absent": "ಗೈ"},
    "ml": {"name": "മലയാളം (Malayalam)", "app_name": "HAI", "tagline": "ಹಾജർ കൃത്രിമ ബുദ്ധി ഉപയോഗിച്ച് പ്രവർത്തിക്കുന്നു", "attendance": "ഹാജർ", "workers": "തൊഴിലാളികൾ", "summary": "സംഗ്രഹം", "settings": "ക്രമീകരണങ്ങൾ", "save": "സംരക്ഷിക്കുക", "cancel": "റദ്ദാക്കുക", "delete": "ഇല്ലാതാക്കുക", "edit": "തിരുത്തുക", "present": "ഹാ", "absent": "അ"},
    "pa": {"name": "ਪੰਜਾਬੀ (Punjabi)", "app_name": "HAI", "tagline": "ਆਰਟੀਫਿਸ਼ੀਅਲ ਇੰਟੈਲੀਜੈਂਸ ਦੁਆਰਾ ਸੰਚਾਲਿਤ", "attendance": "ਹਾਜ਼ਰੀ", "workers": "ਕਾਮੇ", "summary": "ਸਾਰਾਂਸ਼", "settings": "ਸੈਟਿੰਗਾਂ", "save": "ਸੁਰੱਖਿਅਤ ਕਰੋ", "cancel": "ਰੱਦ ਕਰੋ", "delete": "ਮਿਟਾਓ", "edit": "ਸੋਧੋ", "present": "ਹਾ", "absent": "ਗੈ"},
    "or": {"name": "ଓଡ଼ିଆ (Odia)", "app_name": "HAI", "tagline": "ଆର୍ଟିଫିସିଆଲ୍ ଇଣ୍ଟେଲିଜେନ୍ସ ଦ୍ୱାରਾ ଚାଲିତ", "attendance": "ହାଜିରା", "workers": "କର୍ମଚାରୀ", "summary": "ସାରାଂଶ", "settings": "ସେଟିଂସଙ୍ग୍", "save": "ସଂରକ୍ଷଣ", "cancel": "ବାତିଲ୍", "delete": "ଲିଭାନ୍ତុ", "edit": "ସଂଶୋଧନ", "present": "ଉ", "absent": "ଅ"},
    "as": {"name": "অসমীয়া (Assamese)", "app_name": "HAI", "tagline": "হাজিৰা কৃত্ৰিম বুদ্ধিমত্তা দ্বাৰা চালিত", "attendance": "হাজিৰা", "workers": "কৰ্মী", "summary": "সাৰাংশ", "settings": "ছেটিংছ", "save": "সংৰক্ষণ", "cancel": "বাতিল", "delete": "মুচি পেলাওক", "edit": "সম্পাদনা", "present": "উপ", "absent": "অনুপ"},
    "ur": {"name": "اردو (Urdu)", "app_name": "HAI", "tagline": "حاضری مصنوعی ذہانت کے ذریعے چلتی ہے", "attendance": "حاضری", "workers": "مزدور", "summary": "خلاصہ", "settings": "ترتیبات", "save": "محفوظ کریں", "cancel": "منسوخ کریں", "delete": "حذف کریں", "edit": "ترمیم کریں", "present": "حا", "absent": "غ"},
    "sa": {"name": "संस्कृतम् (Sanskrit)", "app_name": "HAI", "tagline": "कृत्रिम बुद्धिमत्ता सञ्चालित हाजिरी", "attendance": "उपस्थिति:", "workers": "कर्मकरा:", "summary": "सारांश:", "settings": "विन्यास:", "save": "रक्षितुम्", "cancel": "निरस्तम्", "delete": "लोपयतु", "edit": "परिवर्तयतु", "present": "उ", "absent": "अ"},
    "ne": {"name": "नेपाली (Nepali)", "app_name": "HAI", "tagline": "हाजिरी कृत्रिम बुद्धिमत्ता द्वारा संचालित", "attendance": "हाजिरी", "workers": "कामदार", "summary": "सारांश", "settings": "सेटिङहरू", "save": "बचत गर्नुहोस्", "cancel": "रद्द गर्नुहोस्", "delete": "হटाउनुहोस्", "edit": "सम्पादन गर्नुहोस्", "present": "उ", "absent": "ग"},
    "kok": {"name": "कोंकणी (Konkani)", "app_name": "HAI", "tagline": "हाजरी कृत्रिम बुद्धिमत्ता वर चालपी", "attendance": "हाजरी", "workers": "कामगार", "summary": "सारांश", "settings": "मांडणी", "save": "सांबाळचें", "cancel": "रद्द करचें", "delete": "काडून उडोवचें", "edit": "बदलचें", "present": "ह", "absent": "ना"},
    "mai": {"name": "मैथिली (Maithili)", "app_name": "HAI", "tagline": "हाजिरी कृत्रिम बुद्धिमत्ता द्वारा संचालित", "attendance": "हाजिरी", "workers": "कामगार", "summary": "सारांश", "settings": "सेटिंग्स", "save": "सुरक्षित करू", "cancel": "रद्द करू", "delete": "मेटाऊ", "edit": "संशोधित करू", "present": "उ", "absent": "अ"},
    "doi": {"name": "डोगरी (Dogri)", "app_name": "HAI", "tagline": "हाजरी कृत्रिम बुद्धिमत्ता कन्नै चलदी", "attendance": "हाजरी", "workers": "कामगार", "summary": "सारांश", "settings": "सेटिंग्स", "save": "बचाओ", "cancel": "रद्द करो", "delete": "हटाओ", "edit": "बदलो", "present": "हा", "absent": "गैर"},
    "sat": {"name": "संथाली (Santali)", "app_name": "HAI", "tagline": "ᱦᱟᱡᱤᱨᱤ ᱟᱨᱴᱤᱯᱷᱤᱥᱤᱭaᱞ ᱤᱱᱴᱮᱞᱤᱡᱮᱱᱥ ᱛᱮ ᱪᱟᱞᱟᱣ", "attendance": "ᱦᱟᱡᱤᱨᱤ", "workers": "ᱠᱟᱹᱢᱤᱭᱟᱹ", "summary": "ᱥᱟᱨᱟᱝᱥ", "settings": "ᱥᱮᱴᱤᱝᱥ", "save": "ᱵᱟᱧᱪａᱣ", "cancel": "ᱵᱟᱹᱛｉｌ", "delete": "ᱜᱤᱰᱤ", "edit": "ᱵᱚᱫᱚ防", "present": "ᱥᱮ", "absent": "ᱵᱟ"},
    "ks": {"name": "कश्मीरी (Kashmiri)", "app_name": "HAI", "tagline": "ہاضری مصنوعی ذہانت پٹھ چلان", "attendance": "ہاضری", "workers": "مزدور", "summary": "خلاصہ", "settings": "سیٹنگس", "save": "بچاو", "cancel": "منसूخ", "delete": "حذف", "edit": "تبدیل", "present": "حا", "absent": "غ"},
    "sd": {"name": "सिंधी (Sindhi)", "app_name": "HAI", "tagline": "حاضري مصنوعي ذهانت ذريعي هلندڙ", "attendance": "حاضري", "workers": "مزدور", "summary": "خلاصو", "settings": "سيٽنگون", "save": "محفوظ ڪريو", "cancel": "رد ڪريو", "delete": "خارج ڪريو", "edit": "تبديل ڪريو", "present": "حا", "absent": "غي"},
    "mni": {"name": "मणिपुरी (Manipuri)", "app_name": "HAI", "tagline": "হাজিৰি আরতিফিসিয়েল ইন্টেলিজেন্সনা চলাইবা", "attendance": "হাজিৰি", "workers": "থবক শুবা", "summary": "শিংলুপ", "settings": "সেত্তিংস", "save": "সেভ তৌবা", "cancel": "কেন্সেল", "delete": "মুথতপা", "edit": "শেমদোকপা", "present": "লৈ", "absent": "লৈতা"}
}

def load_en_base():
    with open("constants/i18n/en.json", "r", encoding="utf-8") as f:
        base = json.load(f)
    # Merge new keys into base English
    for section, keys in new_keys.items():
        base[section] = keys
    return base

def generate_lang(lang_code, lang_data, base):
    lang_json = json.loads(json.dumps(base)) # Deep copy
    
    # 1. Update app info
    lang_json["app"]["name"] = lang_data["app_name"]
    lang_json["app"]["tagline"] = lang_data["tagline"]
    
    # 2. Update tabs
    lang_json["tabs"]["attendance"] = lang_data["attendance"]
    lang_json["tabs"]["workers"] = lang_data["workers"]
    lang_json["tabs"]["summary"] = lang_data["summary"]
    lang_json["tabs"]["settings"] = lang_data["settings"]
    
    # 3. Update main title sections
    lang_json["attendance"]["title"] = lang_data["attendance"]
    lang_json["workers"]["title"] = lang_data["workers"]
    lang_json["summary"]["title"] = lang_data["summary"]
    lang_json["settings"]["title"] = lang_data["settings"]
    
    # 4. Update core buttons / labels
    lang_json["common"]["save"] = lang_data["save"]
    lang_json["common"]["cancel"] = lang_data["cancel"]
    lang_json["common"]["delete"] = lang_data["delete"]
    lang_json["common"]["edit"] = lang_data["edit"]
    
    lang_json["attendance"]["present"] = lang_data["present"]
    lang_json["attendance"]["absent"] = lang_data["absent"]
    
    # 5. Recursive brand replacement in string fields (Haajari AI -> HAI)
    def recursive_rebrand(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if isinstance(v, (dict, list)):
                    recursive_rebrand(v)
                elif isinstance(v, str):
                    val = v.replace("Haajari AI", "HAI")
                    val = val.replace("Haajari Assistant", "HAI Assistant")
                    val = val.replace("Haajari Voice", "HAI Voice")
                    val = val.replace("Haajari Chat", "Ask HAI")
                    val = val.replace("Haajari Live", "HAI Live")
                    val = val.replace("Haajari Copilot", "HAI Copilot")
                    val = val.replace("Ask Haajari", "Ask HAI")
                    obj[k] = val
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                if isinstance(v, (dict, list)):
                    recursive_rebrand(v)
                elif isinstance(v, str):
                    val = v.replace("Haajari AI", "HAI")
                    val = val.replace("Haajari Assistant", "HAI Assistant")
                    val = val.replace("Haajari Voice", "HAI Voice")
                    val = val.replace("Haajari Chat", "Ask HAI")
                    val = val.replace("Haajari Live", "HAI Live")
                    val = val.replace("Haajari Copilot", "HAI Copilot")
                    val = val.replace("Ask Haajari", "Ask HAI")
                    obj[i] = val
                    
    recursive_rebrand(lang_json)
    return lang_json

def main():
    base = load_en_base()
    for code, data in languages.items():
        generated = generate_lang(code, data, base)
        file_path = f"constants/i18n/{code}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(generated, f, ensure_ascii=False, indent=2)
        print(f"Generated {file_path}")

if __name__ == "__main__":
    main()
