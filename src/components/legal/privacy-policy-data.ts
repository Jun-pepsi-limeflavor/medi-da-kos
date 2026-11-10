// Privacy Policy 본문 정적 데이터(Figma 'Privacy Policy — Final Design (1440 · desktop)' 548:1012 › Sections 548:1038 원문 그대로).
// - 14개 조항, 조항 id는 Figma 섹션 이름의 앵커(#privacy-…)
// - 문구를 바꾸지 않는다. 추가한 것은 링크뿐: 웹사이트 주소 → Home, 이메일 → mailto, 'Section 2.3'·'Section 5' → 해당 위치
// - 시행일·최종 수정일: 2026년 11월 13일(Figma 영문 프레임도 같은 표기로 갱신)
import type { LegalDocumentData } from "@/components/legal/LegalDocument";

const WEBSITE = { text: "https://www.medidakos.com/", href: "/" };
const EMAIL = { text: "support@medidakos.com", href: "mailto:support@medidakos.com" };

export const PRIVACY_POLICY: LegalDocumentData = {
  title: "Privacy Policy",
  effectiveDate: "November 13, 2026",
  lastUpdated: "November 13, 2026",
  sections: [
    {
      id: "privacy-introduction",
      title: "1. Introduction",
      blocks: [
        { type: "p", text: "Medidakos, a service operated by Korea Technology Asset Co., Ltd. (hereinafter referred to as “we,” “us,” or “our”), values users' personal information and strives to protect it in accordance with applicable laws and regulations." },
        { type: "p", text: "This Privacy Policy explains how we collect, use, disclose, retain, and protect personal information when users visit our website, use our sign-up and login features, contact us, or communicate with us regarding cosmetic product development and manufacturing services." },
        { type: "field", label: "Legal Entity Name:", value: "Korea Technology Asset Co., Ltd." },
        { type: "field", label: "Website:", value: [WEBSITE] },
        { type: "p", text: "This Privacy Policy also applies to the user accounts, customer dashboard, project management features, and related customer communications that we provide." },
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
        { type: "subheading", text: "③ Customer Dashboard and Project Management Information" },
        { type: "p", text: "When users access the customer dashboard or use manufacturing project-related services, the following additional information may be processed." },
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
            "Referral sources and campaign parameters (UTM)",
            "Cookie identifiers and similar online identifiers",
            "Login status information and account registration and most recent login timestamps",
            "Page URLs, browser information, referral sources, and analytics identifiers collected when inquiries or consultation requests are submitted",
          ],
        },
        { type: "p", text: "We may use technologies such as Google Analytics and Meta Pixel to measure website usage and advertising performance and support personalized advertising activities depending on the relevant settings." },
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
            "Access to and use of the customer dashboard",
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
        { type: "p", text: "The cookies and similar technologies we use are categorized according to their purposes as essential, analytics, marketing, and functional technologies." },
        { type: "p", text: "Analytics and marketing technologies that require consent under applicable laws and regulations are activated when users provide the relevant consent." },
        { type: "p", text: "Users may manage or withdraw their consent to the use of optional cookies through the Cookie Settings feature on our website." },
      ],
    },
    {
      id: "privacy-sharing-and-disclosure-of-personal-information",
      title: "6. Sharing and Disclosure of Personal Information",
      blocks: [
        { type: "p", text: "We may share personal information with or entrust its processing to the following parties." },
        {
          type: "list",
          items: [
            "Manufacturing and development partners involved in reviewing or carrying out users' projects",
            "Technology and hosting providers supporting our website and customer services",
            "Service providers supporting user registration, login, and account authentication",
            "Email and customer communication service providers",
            "Analytics or advertising providers, where applicable and subject to relevant consent requirements",
            "Professional advisors and public authorities where legally required",
          ],
        },
        { type: "p", text: "When users choose to log in with Google, services providing the relevant authentication functionality may be used." },
        { type: "p", text: "We distinguish between the outsourcing of personal information processing and the provision of personal information to third parties in accordance with applicable laws and regulations, and we fulfill any required notification or consent procedures." },
      ],
    },
    {
      id: "privacy-international-data-transfers",
      title: "7. International Data Transfers",
      blocks: [
        { type: "p", text: "Medidakos is based in the Republic of Korea and provides cosmetic product development and manufacturing-related services to customers in the United States, Europe, and other regions. In the course of providing these services, personal information of overseas customers may be transferred to and processed in the Republic of Korea." },
        { type: "p", text: "Additionally, personal information may be processed or stored outside the Republic of Korea through overseas service providers used for user registration, login, customer management, and website operations." },
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
            "Customer dashboard and project information",
            "Contract and transaction records",
            "Website analytics and consent records",
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
        { type: "p", text: "Registered users may request account deletion through the account deletion feature in the customer dashboard." },
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
      ],
    },
  ],
};
