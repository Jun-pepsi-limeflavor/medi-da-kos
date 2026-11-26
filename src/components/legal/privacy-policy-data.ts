// Privacy Policy 본문 정적 데이터(Figma 'Privacy Policy — Final Design (1440 · desktop)' 548:1012 › Sections 548:1038).
// - 14개 조항, 조항 id는 Figma 섹션 이름의 앵커(#privacy-…)
// - 2026-11-26 팀 검토본 반영: 2.2·5(5.1~5.5)·6·7·8 개정, 미구현 대시보드·자동 탈퇴 문구 제외(1·2.1·3·8·10), 14에 개인정보 보호책임자 추가.
//   원문은 Notion 작업본(Medidakos_개인정보처리방침 영문). 6·7은 법률 검토 미완료 상태의 팀 확정 문구
// - 추가한 것은 링크뿐: 웹사이트 주소 → Home, Medidakos 이메일 → mailto, 'Section 2.3'·'Section 5' → 해당 위치, 7의 Google 문의 URL
// - 시행일·최종 수정일: 2026년 11월 26일
import type { LegalDocumentData } from "@/components/legal/LegalDocument";

const WEBSITE = { text: "https://www.medidakos.com/", href: "/" };
const EMAIL = { text: "support@medidakos.com", href: "mailto:support@medidakos.com" };

export const PRIVACY_POLICY: LegalDocumentData = {
  title: "Privacy Policy",
  effectiveDate: "November 26, 2026",
  emailLocation: "privacy-policy",
  lastUpdated: "November 26, 2026",
  sections: [
    {
      id: "privacy-introduction",
      title: "1. Introduction",
      blocks: [
        { type: "p", text: "Medidakos, a service operated by Korea Technology Asset Co., Ltd. (hereinafter referred to as “we,” “us,” or “our”), values users' personal information and strives to protect it in accordance with applicable laws and regulations." },
        { type: "p", text: "This Privacy Policy explains how we collect, use, disclose, retain, and protect personal information when users visit our website, use our sign-up and login features, contact us, or communicate with us regarding cosmetic product development and manufacturing services." },
        { type: "field", label: "Legal Entity Name:", value: "Korea Technology Asset Co., Ltd." },
        { type: "field", label: "Website:", value: [WEBSITE] },
        { type: "p", text: "This Privacy Policy also applies to the user accounts, project-related services, and related customer communications that we provide." },
      ],
    },
    {
      id: "privacy-information-we-collect",
      title: "2. Information We Collect",
      blocks: [
        { type: "h3", text: "2.1 Information You Provide" },
        { type: "p", text: "We may collect or process the following information when users sign up, log in, submit inquiries, or use project-related services through our website." },
        { type: "subheading", text: "① Sign-Up and Account Management Information" },
        { type: "p", text: "When users sign up using their email address, we collect the following information." },
        {
          type: "list",
          items: [
            "Required information: Name, phone number, country, email address, and password",
            "Optional information: Company or brand name",
          ],
        },
        { type: "p", text: "Users may sign up and log in using their email address and password or their Google account." },
        { type: "p", text: "Passwords entered during email sign-up are processed through Firebase Authentication, and we do not store passwords in plain text in our customer information database." },
        {
          type: "p",
          text: [
            "Personal information collected and processed when users sign up or log in using their Google account is described in ",
            { text: "Section 2.3", href: "#privacy-information-received-from-other-sources" },
            ".",
          ],
        },
        { type: "subheading", text: "② Inquiry and Project-Related Information" },
        {
          type: "list",
          items: [
            "Name",
            "Business email address",
            "Company or brand name",
            "Country",
            "Inquiry or project description",
            "Product category",
            "Estimated order quantity per SKU",
            "Company website or social media links",
            "Product development briefs and related materials voluntarily uploaded by users",
            "Information subsequently provided through email or other business communications",
            "Preferences regarding promotional inquiries",
          ],
        },
        { type: "p", text: "Uploaded documents may contain product specifications, business information, or other information voluntarily provided by users." },
        { type: "subheading", text: "③ Project Management Information" },
        { type: "p", text: "When users use manufacturing project-related services, the following additional information may be processed." },
        {
          type: "list",
          items: [
            "Customer account and project identification information",
            "Project progress and related communications",
            "Product development briefs and sample-related information",
            "Production schedules and progress updates",
            "Contract, payment, and transaction-related information",
            "Shipping and export-related information",
          ],
        },
        { type: "h3", text: "2.2 Information Collected Automatically" },
        { type: "p", text: "We may automatically collect or process the following information to operate our website, provide services, authenticate users, analyze website usage, and measure advertising performance." },
        {
          type: "list",
          items: [
            "IP address",
            "Browser type, device information, and operating system",
            "Website usage and interaction records, such as pages visited, access dates and times, and clicks",
            "Referral sources and campaign parameters (UTM), where users consent to the relevant analytics or marketing technologies",
            "Cookie identifiers and similar online identifiers",
            "Login status information and account registration and most recent login timestamps",
            "Page URLs and browser information collected when inquiries or consultation requests are submitted, and the Google Analytics identifier where users consent to analytics technologies; page URLs include query parameters, such as campaign parameters, only where users consent to analytics technologies",
          ],
        },
        { type: "p", text: "We may use technologies such as Google Analytics, Google Ads conversion measurement through Google Analytics, and Meta Pixel to measure website usage and advertising performance and support personalized advertising activities depending on the relevant settings." },
        { type: "p", text: "Cookies and similar technologies used for analytics and marketing purposes are processed in accordance with user consent and privacy settings as required by applicable laws and regulations." },
        {
          type: "p",
          text: [
            "Further information about cookies and similar technologies is provided in ",
            { text: "Section 5", href: "#privacy-cookies-and-similar-technologies" },
            ".",
          ],
        },
        { type: "h3", text: "2.3 Information Received from Other Sources", id: "privacy-information-received-from-other-sources" },
        { type: "p", text: "We may receive business contact information or project-related information from users' authorized representatives or manufacturing partners participating in their projects." },
        { type: "p", text: "When users sign up or log in using their Google account, we receive their email address and name through Google's authentication services and use this information for user identification, account creation, and login authentication." },
        { type: "p", text: "During this process, information such as Google account identifiers and profile picture URLs may be processed through Firebase Authentication for authentication purposes. We do not store these profile pictures in a separate customer information database or use them for service operations." },
        { type: "p", text: "We do not receive or store users' Google account passwords." },
      ],
    },
    {
      id: "privacy-purposes-of-using-information",
      title: "3. Purposes of Using Information",
      blocks: [
        { type: "p", text: "We may use personal information for the following purposes." },
        { type: "subheading", text: "① Membership and Account Management" },
        {
          type: "list",
          items: [
            "User registration and customer account creation",
            "User identification and login authentication",
            "Support for login using Google accounts",
            "Account access and security management",
            "Account-related notifications and customer support",
            "Processing requests to update account information and manage accounts",
            "Processing account deletion requests",
            "Processing requests to exercise user rights, including access to, correction of, and deletion of personal information",
          ],
        },
        { type: "subheading", text: "② Customer Inquiries and Project Management" },
        {
          type: "list",
          items: [
            "Responding to inquiries and quotation requests",
            "Reviewing cosmetic product development and manufacturing requirements",
            "Communicating regarding product concepts, samples, production, and project progress",
            "Coordinating with relevant manufacturing and service partners",
            "Sending inquiry confirmations and service-related notifications",
            "Managing ongoing customer relationships and project records",
            "Supporting order, payment, and shipping-related operations",
          ],
        },
        { type: "subheading", text: "③ Website Operations and Other Purposes" },
        {
          type: "list",
          items: [
            "Maintaining website security and functionality",
            "Analyzing website performance",
            "Measuring advertising performance",
            "Complying with legal and regulatory obligations",
          ],
        },
      ],
    },
    {
      id: "privacy-legal-bases-for-processing",
      title: "4. Legal Bases for Processing",
      blocks: [
        { type: "p", text: "Where applicable data protection laws apply, we process personal information on the following legal bases." },
        {
          type: "list",
          items: [
            "User consent",
            "Taking steps at the user's request before entering into a contract",
            "Performance of a contract",
            "Compliance with applicable legal obligations",
            "Our legitimate interests, to the extent permitted by law and where such interests are not overridden by users' rights",
          ],
        },
        { type: "p", text: "The applicable legal basis may vary depending on the processing activity and the user's jurisdiction." },
        { type: "p", text: "The specific legal bases for user registration, account authentication, responding to inquiries, project management, and optional marketing activities are determined according to applicable laws and actual processing practices." },
      ],
    },
    {
      id: "privacy-cookies-and-similar-technologies",
      title: "5. Cookies and Similar Technologies",
      blocks: [
        { type: "p", text: "We may use cookies, browser storage, pixels, and similar technologies to support website functionality, authenticate users and maintain services, understand how visitors use our website, and measure advertising performance." },
        { type: "h3", text: "5.1 Types of Technologies" },
        { type: "p", text: "We use cookies, browser storage technologies (local storage, session storage, and IndexedDB), and pixels. Information in session storage is deleted when the browser tab is closed. The expiration periods described in this Privacy Policy and in Cookie Details may be shortened by browser settings or limits." },
        { type: "h3", text: "5.2 Categories of Technologies" },
        { type: "p", text: "Essential technologies are necessary for essential website functions, such as authentication, security, consent management, and live chat support, including monitoring of the chat service. They are always active and include the following:" },
        {
          type: "list",
          items: [
            "Login status stored in browser storage (IndexedDB) by Firebase Authentication while users are logged in, which is deleted when users log out",
            "Diagnostic information about the use of the Firebase software development kit, stored in browser storage (IndexedDB)",
            "Records of users' cookie choices, stored in local storage",
            "Cookies and browser storage used by Channel Talk to maintain live chat sessions, recognize returning chat visitors, keep previous conversations and chat settings available, and support the operation of the live chat service",
            "A cookie set through the Channel Talk chat widget by Datadog, a monitoring service used by Channel Talk, to monitor errors and performance of the chat widget. The cookie may remain in the browser for up to one year, while each monitoring session recorded in it ends after 15 minutes of inactivity or after a maximum of four hours.",
          ],
        },
        { type: "p", text: "Live chat remains available regardless of users' choices regarding optional technologies." },
        { type: "p", text: "Analytics technologies, such as Google Analytics, help us understand how visitors use our website and measure website performance. Google Analytics is loaded only after users consent to analytics technologies. With this consent, the Google Analytics identifier and the campaign parameters (UTM) of the landing page may be kept in the browser tab and attached to inquiries submitted through our website, and the submission of an inquiry may be recorded in Google Analytics as a conversion." },
        { type: "p", text: "Marketing technologies help measure advertising performance and support personalized advertising activities depending on the relevant settings. They include Meta Pixel, which is loaded only after users consent to marketing technologies, and Google Ads conversion measurement. Because Google Ads conversion measurement on our website operates through Google Analytics, it requires consent to both analytics and marketing technologies. We allow Google to use Google Analytics data for advertising measurement only when users consent to marketing technologies, and Google Ads click information is stored in the browser only when users consent to both analytics and marketing technologies and arrive from a Google ad." },
        { type: "h3", text: "5.3 Consent and Cookie Settings" },
        { type: "p", text: "Analytics and marketing technologies are activated only after users provide the relevant consent." },
        { type: "p", text: "Users may accept or reject all optional technologies, or choose analytics and marketing technologies separately, through the Cookie Settings feature on our website, and may change or withdraw their consent at any time. When users withdraw consent, we stop the related technologies and delete the related cookies and browser storage from their browser. Google Ads-related browser storage is deleted when users withdraw consent to either analytics or marketing technologies." },
        { type: "p", text: "If a user's browser sends a Global Privacy Control (GPC) signal, we treat it as a refusal of marketing technologies, and marketing technologies remain disabled." },
        { type: "p", text: "Users' choices remain valid for six months, after which we ask again. We may also ask users again when the technologies or purposes described in our cookie notice change." },
        { type: "h3", text: "5.4 Consent Records" },
        { type: "p", text: "To keep a record of cookie choices, we generate a random consent identifier and store it in the user's browser. Each time a user makes or changes a choice, we record on our server the consent identifier, the choices made, the type of action, the version of the cookie notice shown, whether the choice was made in the cookie banner or in Cookie Settings, whether a GPC signal was sent, and the time of the choice. Consent records do not include users' names, email addresses, account identifiers, or analytics identifiers, and we do not attach the consent identifier to inquiries, user accounts, or analytics data. Consent records are retained for 18 months from the date of each record." },
        { type: "h3", text: "5.5 Cookie Details" },
        { type: "p", text: "The names, types, providers, purposes, and expiration periods of the cookies used on our website, and of the browser storage used for analytics and marketing purposes, are listed in Cookie Details within Cookie Settings." },
      ],
    },
    {
      id: "privacy-sharing-and-disclosure-of-personal-information",
      title: "6. Sharing and Disclosure of Personal Information",
      blocks: [
        { type: "p", text: "We entrust the processing of personal information to the following service providers to operate our website and services." },
        {
          type: "list",
          items: [
            "Google (Firebase, Google Cloud, Google Workspace): user authentication, data storage, server operations, service-related emails, and file storage",
            "Google (Google Analytics): website analytics, where users consent to analytics technologies",
            "Channel Corp. (Channel Talk): live chat, customer consultation, and customer relationship management",
            "Vercel Inc.: website hosting and server functions",
          ],
        },
        { type: "p", text: "Where users consent to marketing technologies, website usage information and cookie identifiers are shared with Meta (Meta Pixel) and Google (Google Ads) to measure advertising performance. These companies may also use this information for their own purposes in accordance with their own privacy policies." },
        { type: "p", text: "We may also share personal information with manufacturing and development partners involved in users' projects, and with professional advisors or public authorities where required by law." },
      ],
    },
    {
      id: "privacy-international-data-transfers",
      title: "7. International Data Transfers",
      blocks: [
        { type: "p", text: "Medidakos is based in the Republic of Korea and provides cosmetic product development and manufacturing-related services to customers in the United States, Europe, and other regions. In the course of providing these services, personal information of overseas customers may be transferred to and processed in the Republic of Korea." },
        { type: "p", text: "Our main database and file storage are located in the Republic of Korea. Personal information is also processed by the service providers listed in Section 6, some of which process it outside the Republic of Korea, including the following. This information is transmitted over the network when users use the relevant features." },
        {
          type: "list",
          items: [
            [
              "Google (Firebase Authentication), United States: name, email address, password (stored in hashed form), and Google account identifiers, for user authentication. Retained until the user's account is deleted, after which it is removed from Google's systems within 180 days. Contact: ",
              { text: "https://support.google.com/policies/troubleshooter/2990837", href: "https://support.google.com/policies/troubleshooter/2990837" },
            ],
            "Vercel Inc., United States: IP address, browser information, access records, and login authentication information, for website hosting and server functions. Retained only as long as necessary to provide the service and deleted when our agreement with Vercel ends. Contact: privacy@vercel.com",
          ],
        },
        { type: "p", text: "Where users consent to analytics or marketing technologies, Google and Meta may process the related information in the countries where they operate." },
        { type: "p", text: "We comply with applicable laws and regulations regarding international transfers of personal information and implement the necessary safeguards." },
      ],
    },
    {
      id: "privacy-data-retention",
      title: "8. Data Retention",
      blocks: [
        { type: "p", text: "We retain personal information only for as long as necessary to fulfill the purposes described in this Privacy Policy, comply with legal obligations, resolve disputes, or maintain legitimate business records." },
        { type: "p", text: "Retention periods may vary for the following categories." },
        {
          type: "list",
          items: [
            "User registration and customer account information",
            "Login, authentication, and account security records",
            "Account information associated with Google login",
            "General inquiries and communications",
            "Uploaded project briefs and related files",
            "Project information",
            "Contract and transaction records",
            "Website analytics records",
            "Cookie consent records, which are retained for 18 months from the date of each record",
          ],
        },
        { type: "p", text: "When users request account deletion, we delete their user accounts after verifying their identity and completing the necessary procedures. Personal information for which the processing purpose has been fulfilled is destroyed in accordance with applicable laws and regulations and our internal retention policies." },
        { type: "p", text: "However, information that must be retained under applicable laws and regulations for purposes such as contract performance, transaction record retention, or dispute resolution will be stored separately for the required period and will not be used for other purposes." },
      ],
    },
    {
      id: "privacy-security",
      title: "9. Security",
      blocks: [
        { type: "p", text: "We take reasonable technical and administrative measures to protect personal information against unauthorized access, disclosure, alteration, or destruction." },
        { type: "p", text: "These measures may include appropriate access controls, authentication, secure data transmission, and restrictions on access to customer information." },
        { type: "p", text: "We use Firebase Authentication for user authentication through email addresses and passwords, and we do not store passwords in plain text in our customer information database." },
        { type: "p", text: "We implement technical and administrative safeguards, including access permission management, authentication, and secure transmission, to protect personal information." },
        { type: "p", text: "User account login information and authentication data are processed in accordance with the authentication systems actually used and their relevant security policies." },
        { type: "p", text: "No method of electronic transmission or storage can guarantee complete security." },
      ],
    },
    {
      id: "privacy-user-rights",
      title: "10. User Rights",
      blocks: [
        { type: "p", text: "Depending on their place of residence and applicable laws and regulations, users may have the following rights." },
        {
          type: "list",
          items: [
            "Access to personal information",
            "Request correction of inaccurate information",
            "Request deletion of personal information",
            "Object to or restrict certain processing activities",
            "Withdraw consent",
            "Request data portability, where applicable",
          ],
        },
        {
          type: "p",
          text: [
            "Registered users may request deletion of their accounts by contacting us at ",
            EMAIL,
            ". We will review the request, verify the requester's identity, and process it.",
          ],
        },
        { type: "p", text: "Requests concerning access to, correction of, or deletion of personal information, as well as the exercise of other rights, may be submitted through the privacy contact information provided below." },
        { type: "p", text: "We review and process user requests in accordance with applicable laws and regulations and our internal procedures." },
      ],
    },
    {
      id: "privacy-third-party-websites-and-services",
      title: "11. Third-Party Websites and Services",
      blocks: [
        { type: "p", text: "Our website may contain links to external websites, including social media platforms." },
        { type: "p", text: "When users leave our website, the privacy practices of those external services are governed by their respective policies." },
        { type: "p", text: "When users use the Google account login feature, Google's relevant services and Privacy Policy may apply." },
        { type: "p", text: "Where third-party content is embedded directly into our website, the related data processing is explained in the applicable privacy and cookie notices." },
      ],
    },
    {
      id: "privacy-children-s-personal-information",
      title: "12. Children's Personal Information",
      blocks: [
        { type: "p", text: "Our website and services are primarily intended for businesses and professional users and are not directed at children." },
        { type: "p", text: "We do not intentionally seek to collect children's personal information through our user registration and business inquiry services." },
      ],
    },
    {
      id: "privacy-changes-to-this-privacy-policy",
      title: "13. Changes to This Privacy Policy",
      blocks: [
        { type: "p", text: "We may update this Privacy Policy to reflect changes in our services, personal information processing practices, or legal requirements." },
        { type: "p", text: "The latest version will be published on our website together with the updated effective date or last updated date." },
        { type: "p", text: "Where necessary, we will provide additional notice or request consent again." },
      ],
    },
    {
      id: "privacy-contact-information",
      title: "14. Contact Information",
      blocks: [
        { type: "p", text: "For inquiries regarding this Privacy Policy or to exercise rights relating to personal information, please contact us using the information below." },
        { type: "field", label: "Legal Entity Name:", value: "Korea Technology Asset Co., Ltd." },
        { type: "field", label: "Business Address:", value: "6 Jong-ro, Jongno-gu, Seoul, Republic of Korea" },
        { type: "field", label: "Privacy Inquiries:", value: [EMAIL] },
        { type: "h3", text: "Personal Information Protection Officer" },
        { type: "field", label: "Name:", value: "Park JunYoung" },
        { type: "field", label: "Phone:", value: "+82 10 3593 9747" },
        { type: "field", label: "Email:", value: [EMAIL] },
      ],
    },
  ],
};
