# Building a self-sustaining ADHD app as a solo founder

The path to a self-sustaining ADHD support app requires approximately **2,000 paying subscribers at $50/year** to generate the roughly $85,000 annual gross revenue needed after Apple's 15% Small Business Program cut. This translates to needing 50,000-100,000 downloads annually at typical 2-4% conversion rates—achievable within 18-24 months through organic growth via Reddit, TikTok, and App Store Optimization. The ADHD app market is valued at **$1.8-2.1 billion** with 15% annual growth, and recent success stories like Tiimo (iPhone App of the Year 2025) and Rootd (solo-founded, $1M+ ARR) demonstrate this is viable territory for indie developers.

Your primary technical advantage: SwiftUI is now production-ready for cross-platform iOS/macOS development, with solo developers shipping full MVPs in 8-12 weeks. The highest-risk element isn't technical—it's retention. **54% of ADHD app users drop out before Week 7**, with 36% leaving before Week 2. Your MVP must deliver value in under 2 minutes and never punish users for missed tasks.

## Subscription economics favor the patient indie developer

RevenueCat's 2024-2025 data reveals that **higher prices correlate with higher conversion rates**—apps with premium positioning see 2.66% median download-to-paid conversion versus 1.49% for low-priced apps. The optimal pricing structure for your category centers on **$6.99-9.99/month** or **$39.99-49.99/year**, with a $149-199 lifetime option for early revenue. Mental health and productivity apps benefit from the Health & Fitness category's relatively strong economics: **3.6% median conversion** versus 1.7% across all apps, with the top 10% achieving 12%+ conversion.

The math for sustainability is straightforward but demanding. Assuming $70,000 target annual income plus Apple's 15% cut and self-employment costs, you need roughly **$90,000-100,000 gross annual revenue**. At $49.99/year, that's approximately 2,000 active annual subscribers. To maintain 2,000 subscribers with typical churn, you need about 50,000-100,000 downloads annually depending on your conversion rate—roughly **130-300 downloads per day**.

Real-world case studies prove this is achievable. **Rootd**, a solo-founded anxiety app, generates $1M+ ARR with zero employees—founder Ania Wysocka increased revenue 600% with a single onboarding paywall tweak. **HabitKit**, a habit tracker by solo developer Sebastian Röhl, reached $10,000 MRR with 120,000 downloads by building in public. **Structured**, a visual planner popular with ADHD users, saw 10x revenue growth after switching from paid-upfront to subscription in January 2021.

Trial strategy matters significantly. Longer trials of 14-32 days show **45.7% median trial-to-paid conversion** versus 26.8% for shorter trials, though 82% of trial starts occur on Day 0—your onboarding paywall design is critical. Consider testing a hard paywall (gated free trial) versus freemium; hard paywalls convert at 12.1% median versus 2.2% for freemium at the median, though freemium builds larger audiences for organic growth.

## SwiftUI enables rapid cross-platform development

SwiftUI is now your best choice for building iOS and macOS apps simultaneously. A solo developer recently shipped a complete habit tracker in **5 weeks** including widgets, SwiftData sync, and visionOS support—roughly 50% less code than the UIKit equivalent. Target iOS 16+/macOS 13+ as your minimum to access mature SwiftUI features including custom layouts, improved navigation, and keyboard focus management.

Your first-year costs can stay remarkably low. The **Apple Developer Program at $99/year** is mandatory. If you already own a Mac, backend services can start free—CloudKit is included with your developer account, Firebase and Supabase offer generous free tiers, and Apple's Push Notification service is free. Realistic first-year budget: $100-500 minimum, $2,000-4,000 if purchasing new hardware. TestFlight provides free beta testing for up to 10,000 users, and Xcode Cloud includes 25 compute hours monthly.

For calendar integration, iOS 17+ introduced **write-only calendar access**—you can add events without requesting permission to read users' existing calendars, dramatically simplifying the permission flow. Use EventKitUI's EKEventEditViewController, which runs in a separate process and requires no Calendar access permission for simple event adding. Store calendar identifiers in UserDefaults if you create custom calendars.

Background processing has severe limitations you must design around. iOS grants roughly 3 minutes when moving to background and 30 seconds when resumed. **Do not rely on background processing for reminders**—use local notifications instead. You're limited to 64 pending local notifications, which is sufficient for most ADHD app use cases. Background fetch is not guaranteed at specific intervals; the system manages timing based on user behavior, battery level, and resource availability.

## Screen Time API presents a frustrating limitation

If you're planning self-control features that block distracting apps during focus sessions, understand the critical limitation: **users can disable Screen Time access for third-party apps in Settings with just Face ID**—no passcode required. This is the #1 developer complaint about the Screen Time API and remains unfixed through iOS 18. You can implement app blocking, but users determined to bypass it easily can.

This suggests a design pivot: **gamification and positive reinforcement work better than restriction-based approaches** for ADHD users. Consider tracking focus sessions with rewards rather than attempting to lock users out of distracting apps.

HealthKit integration offers value for correlating sleep, activity, and mindfulness with focus patterns, but design for graceful degradation—many users won't grant access, and you cannot detect whether read permission was denied versus granted-but-empty. The Focus Mode API provides excellent integration potential: implement SetFocusFilterIntent so your app appears in Focus Filter selection, automatically adjusting behavior when users enable specific Focus modes.

## Body doubling infrastructure is achievable at small scale

Focusmate, the leading body doubling app, uses **Daily.co** for video infrastructure after abandoning open-source WebRTC (video error rates dropped 89% after switching). At small scale, video infrastructure is affordable: both Daily.co and 100ms offer **10,000 free minutes monthly**, with video at $0.004/participant-minute and audio-only at $0.001/participant-minute beyond free tier.

Cost estimates for 500 active users (assuming 5 sessions/user/week at 50 minutes): approximately **$960/month for video** or **$240/month for audio-only**. Audio-only sessions cut costs by 75% and may actually work well for ADHD users who find video overwhelming.

However, the smartest MVP approach avoids heavy video infrastructure entirely. Several alternatives can deliver accountability without real-time video:

Community presence systems show who's working without video—Deepwrk's Focus Space proves text chat plus presence indicators works. AI accountability partners are emerging; apps like ADHD Buddy actually call users for check-ins at ~$10-15/month. Async accountability through goal-setting with check-ins (like Beeminder or StickK) requires only a messaging system. Pre-recorded body doubling videos (like dubbii at $5.99/month for housework) eliminate infrastructure entirely.

**Recommended MVP approach**: Start with async accountability and community presence, then add video sessions only if user demand validates the feature. This minimizes infrastructure complexity while testing core value propositions.

## Organic growth channels favor scrappy founders

The ADHD community congregates in specific places online. **r/ADHD on Reddit has 1.2+ million members** and maintains strict moderation against unproven "life hacks"—but genuine, helpful participation builds credibility for eventual product mentions. The effective Reddit strategy requires 4-6 months of authentic participation before any promotion: comment helpfully on 3-5 posts daily, build karma to 500+, and only mention your app when directly relevant and helpful. Be transparent about being the founder.

TikTok delivers exceptional organic reach for ADHD content. Tiimo maintains an active presence using content formats like "study with me" sessions, app walkthroughs solving specific problems, and educational content about ADHD brains. Key hashtags include #ADHDtiktok, #neurodivergent, #productivity, and #adhdtips. Post 1-2x daily using native features and consider partnering with ADHD creators in the 10K-100K follower range for UGC content at $50-250 per video.

App Store Optimization deserves significant investment since **70% of App Store visitors use search** and 65% of downloads occur immediately after a search. Place your primary keyword in the app title (yields 10.3% ranking improvement), maximize the 100-character keyword field using commas between keywords, and lead screenshots with problem-solution messaging showing visual timers and colorful interfaces. Consider positioning in "Productivity" rather than "Health & Fitness" to signal wellness positioning and avoid additional App Store scrutiny.

Paid user acquisition benchmarks for context: iOS CPI averages $1.00 for Apple Search Ads, $1.80 for Facebook, $2.23 for Instagram. Subscription CPA for health/wellness runs **$27.50-50.00**. Start paid only after 4-6 months of organic foundation once you understand what messaging resonates.

## Essential features address time blindness and decision paralysis

User research consistently identifies the same core needs. **Visual timers and countdowns** address time blindness—the single feature most cited as differentiating Tiimo from competitors. A clean, simple interface prevents decision paralysis; complex apps are "a no-go" for ADHD brains. Task breakdown (ideally AI-powered) reduces the executive function load that causes task avoidance. Customizable notifications respect that 72% of users feel stressed by contextually irrelevant alerts. Automatic task rollover eliminates shame—unfinished tasks should move forward without manual rescheduling.

The critical insight for retention: **ADHD apps must never punish users for failure**. Tiimo's design philosophy explicitly avoids red warnings and "overdue" guilt messages—tasks just move forward gently. Finch frames itself around "small wins" with "no pressure." This contrasts with apps like Habitica that reduce health for missed tasks, which can trigger shame spirals in ADHD users.

Onboarding must deliver value within 60 seconds. Minimize decisions, show don't tell, and ensure the first completable action takes under 2 minutes. Pre-built routine templates dramatically reduce setup friction—Tiimo users specifically praise "example plans already set up" that users customize. Allow skipping non-essential setup; never block access to core functionality behind configuration.

Notification strategy requires careful calibration. ADHD users need reminders (prospective memory is impaired) but are also more vulnerable to notification fatigue. Limit to 3-5 daily maximum by default, with opt-in for more. Use unique sounds/visuals for different notification types—differentiation prevents tuning out. Offer granular per-notification-type controls, not just on/off. Include 2-minute transition reminders before the next activity to help with task-switching difficulties.

Gamification works when implemented correctly. Research shows gamified apps achieve **48% higher retention and 60% boost in task compliance**—but rewards must be immediate (ADHD brains heavily discount delayed rewards) and partial progress should still be celebrated. Avoid all-or-nothing designs that mirror the perfectionism thinking already plaguing many ADHD users.

## Legal compliance is achievable by staying in the wellness category

An ADHD support app focused on productivity tools, habit tracking, and reminders can avoid FDA regulation by staying in the "wellness" category. The FDA explicitly excludes from medical device regulation apps that "maintain or encourage a healthy lifestyle" unrelated to diagnosis, cure, mitigation, prevention, or treatment of a disease. Your app becomes a regulated medical device only if you diagnose or treat ADHD or its symptoms, provide specific treatment recommendations, or claim clinical outcome improvements.

**Marketing language matters critically**. Frame your app around "focus and productivity tools," "organization and time management," and "habit building and routine support." Never claim to "treat ADHD," "improve ADHD symptoms," or provide "therapeutic intervention." Consider listing in "Productivity" rather than "Health & Fitness" or "Medical" on the App Store.

HIPAA generally does not apply to consumer wellness apps when you're not a covered entity, don't receive health data from covered entities, and users enter their own data on their own devices. However, the FTC's amended **Health Breach Notification Rule** (effective July 2024) now covers most health and wellness apps, including mental health tracking. Unauthorized disclosure to third parties—including sharing with analytics or advertising without explicit authorization—constitutes a "breach" requiring notification within 60 days, with penalties up to $51,744 per violation. Recent enforcement against BetterHelp, GoodRx, and Premom demonstrates aggressive FTC action.

For App Store compliance, you must provide a privacy policy accessible in-app and on the listing, accurate Privacy Nutrition Labels, and account deletion capability if you support account creation. HealthKit data cannot be used for marketing, advertising, or use-based data mining. Include a prominent medical disclaimer: "This app is not intended to diagnose, treat, cure, or prevent any disease or mental health condition. It is not a substitute for professional medical advice."

## A practical 12-week MVP development roadmap

**Weeks 1-2: Foundation.** Finalize feature scope around visual timers, simple task management with AI breakdown, customizable notifications, and daily focus setting. Design pre-built routine templates. Set up SwiftUI project with iOS 16+/macOS 13+ targets. Create Reddit and TikTok accounts and begin authentic community participation.

**Weeks 3-6: Core development.** Build the visual timer and timeline view—your key differentiating feature. Implement task management with automatic rollover and EventKit integration using write-only access. Develop the notification system with granular controls. Create home screen widgets. Begin posting daily TikTok content showing development progress.

**Weeks 7-10: Polish and integration.** Build onboarding flow with pre-built templates and under-2-minute first value. Implement subscription paywall using RevenueCat (free under $2,500 MTR). Add gamification elements—immediate visual feedback, streak tracking with recovery paths. Set up CloudKit sync. Begin closed beta via TestFlight.

**Weeks 11-12: Launch preparation.** Optimize App Store listing—keywords, screenshots, privacy policy. Prepare launch content for Reddit (r/ADHD, r/iosapps) and TikTok. Set up basic analytics. Submit for App Store review. Plan for 24-48 hour to several-day review time.

**Post-launch priorities.** Focus on first-week retention metrics. Respond to every user review and support request. Continue 2x daily TikTok posting. Test Apple Search Ads at $50-100/month once you understand conversion. Consider community Discord for power users and feedback.

## The critical success factors for solo ADHD app founders

The winners in this space share common characteristics. **Rootd's solo founder responds personally to every review** and built B2B partnerships for diversified revenue. **Tiimo was co-founded after Melissa was diagnosed with ADHD**—lived experience and authentic understanding resonates with users. **Finch started their community on Day 1** of development, building alongside users rather than for them. **HabitKit's founder built in public** with 17+ blog articles driving 14K+ Twitter followers.

Expect **2-3 years to reach sustainability**—the top 5% of apps after one year earn $8,880 gross, and most apps fail to reach $1,000/month. The path forward requires patience, authentic community engagement, and relentless focus on the first-week user experience. But the market is real, the tools are accessible, and solo founders have proven it's achievable.