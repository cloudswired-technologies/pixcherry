# EventSnap — Event Photo Gallery SaaS

## 1. Product Overview

EventSnap is a lightweight SaaS platform for weddings and events.

The goal is simple: guests scan a QR code at an event, upload photos from their phones, and all photos are collected into one shared event gallery.

The first version should focus on speed, simplicity, and low operating cost. Do not overbuild the MVP.

## 2. Core Problem

After weddings and events, guests usually have hundreds of photos scattered across different phones and WhatsApp chats.

The organiser wants one simple place where everyone can contribute photos and where the complete event album can be accessed afterward.

## 3. Target Users

Primary:
- Wedding couples
- Wedding/event organisers
- Private event hosts

Potential future customers:
- Wedding photographers
- Event planners
- Corporate event organisers
- Birthday/party organisers

## 4. Core User Flow

### Organiser

1. Visit the website.
2. Create an event.
3. Enter:
   - Event name
   - Event date
   - Optional description
   - Optional cover image
4. Pay RM50 for the event.
5. System creates the event gallery.
6. System generates a unique QR code.
7. Organiser downloads or displays the QR code at the venue.
8. Guests scan the QR code and upload photos.
9. Organiser can view the gallery and manage photos.
10. After the event, the organiser can download the complete album.

### Guest

1. Scan the event QR code.
2. Event page opens immediately on mobile.
3. See event name and basic information.
4. Enter name/nickname if required.
5. Select or take photos.
6. Upload photos.
7. See upload progress.
8. Photos appear in the shared event gallery.
9. Guest can continue browsing the gallery.

The guest experience should require as little friction as possible. Ideally, guests should not need to create an account.

## 5. MVP Features

### Event Management
- Create event
- Edit event details
- Event start/end date
- Unique event URL
- Event status: upcoming, active, expired
- Event cover image

### QR Code
- Generate unique QR code for every event
- Download QR code as PNG
- Display QR code on screen
- QR code links directly to the event upload/gallery page

### Photo Upload
- Mobile-first upload interface
- Upload multiple photos
- Take photos directly from phone camera
- Upload progress indicator
- Basic file validation
- Maximum file size
- Maximum number of photos per guest
- Automatic image compression/resizing to control storage costs

### Shared Gallery
- Grid-style photo gallery
- Sort by newest/oldest
- View individual photo
- Basic photo metadata
- Download individual photo
- Download entire album

### Guest Limits

For the MVP, each guest can have a configurable upload limit.

Example:
- 20 photos per guest

This should help control abuse and storage costs.

## 6. Storage & Retention

Storage cost control is a key part of the product.

Suggested model:

### During Event
Photos remain available in the gallery.

### After Event
Keep photos in active storage for approximately 7 days after the event.

During this period:
- Organiser can download the album
- Guests can continue accessing the gallery
- Organiser can share the gallery link

### After Retention Period
Photos are automatically deleted from active storage.

The system should:
- Warn the organiser before deletion
- Clearly show the deletion date
- Provide an option to download the complete album before deletion

Important: the retention period should be configurable in the future, but the MVP can use a fixed 7-day period.

## 7. Pricing

Initial pricing hypothesis:

### RM50 per event

This is a simple one-time payment rather than a monthly subscription.

The product should be designed so pricing can later support:
- Basic event
- Premium event
- Longer storage
- Higher upload limits
- Larger storage capacity
- Custom branding

Do not build a complex subscription system in the MVP unless required.

## 8. Admin Dashboard

Basic organiser dashboard:

- Event name
- Event date
- Event status
- QR code
- Total guests
- Total photos
- Storage used
- Gallery link
- Download album
- Deletion date
- Payment status

Optional:
- Recent uploads
- Delete individual photos
- Disable uploads
- Regenerate QR code

## 9. Admin / Platform Dashboard

A simple platform admin area for the owner:

- Total events
- Active events
- Expired events
- Total photos
- Storage usage
- Revenue
- Recent events
- Storage cleanup status

This dashboard is mainly for monitoring the SaaS and controlling costs.

## 10. Recommended Technical Approach

The product should be built as a modern web application.

Priorities:
- Mobile-first
- Fast loading
- Simple UI
- Cheap infrastructure
- Object storage for photos
- Database for event/user/payment metadata
- Automatic image compression
- Scheduled deletion/cleanup

Avoid storing uploaded images directly in the application server filesystem.

The architecture should allow photos to be automatically deleted after the retention period.

## 11. Important Security & Abuse Controls

MVP should include:

- Unique unguessable event IDs/URLs
- Upload rate limiting
- File type validation
- File size limits
- Image count limits
- Basic abuse protection
- Organiser ability to delete unwanted photos
- No public access to platform/admin data
- Secure payment confirmation before activating a paid event

Do not assume uploaded files are safe. Validate and process images before making them available.

## 12. MVP Screens

Build only these main screens initially:

1. Landing page
2. Create event
3. Payment
4. Payment success / event created
5. Organiser dashboard
6. QR code page
7. Guest upload page
8. Shared gallery
9. Photo viewer
10. Admin dashboard

## 13. Landing Page Messaging

Core message:

"Everyone's photos. One event album."

Supporting message:

"Put one QR code at your wedding or event. Guests scan, snap and upload. Everyone's photos come together in one shared gallery."

CTA:

"Create Your Event"

Pricing CTA:

"RM50 per event"

## 14. MVP Non-Goals

Do NOT build these initially:

- Native mobile apps
- AI photo editing
- Face recognition
- Social networking
- Complex user profiles
- Chat
- Photo comments/likes
- Advanced photo editing
- Complex subscription management
- Multiple storage tiers
- Photographer CRM
- Advanced analytics
- Custom domains
- Complex event ticketing

These can be considered only after validating demand.

## 15. Success Metrics

Track:

- Number of events created
- Number of paid events
- Number of guests per event
- Photos uploaded per event
- Upload success rate
- Storage consumed per event
- Download rate
- Repeat customers
- Cost per event
- Revenue per event

The most important early question is:

"Will people pay RM50 for this?"

## 16. Suggested MVP Development Order

Phase 1:
- Landing page
- Event creation
- Database
- Event URL

Phase 2:
- QR generation
- Guest upload
- Image processing
- Cloud storage

Phase 3:
- Shared gallery
- Photo viewer
- Download album

Phase 4:
- Payment
- Organiser dashboard
- Retention/deletion automation

Phase 5:
- Admin dashboard
- Usage/cost monitoring
- Abuse protection
- Polish mobile UX

## 17. Product Principle

Keep the product extremely simple.

The entire value proposition should be understandable in one sentence:

"Scan one QR code and collect everyone's event photos in one album."

The MVP should be good enough to launch quickly, charge RM50, and learn from real customers before adding more features.
