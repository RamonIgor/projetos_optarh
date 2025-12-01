# **App Name**: CollabTask

## Core Features:

- Activity Input: Input field for users to add new activities, storing the 'name' and initializing other fields.
- Activity Validation: Check for similar activity names upon adding, prompting the user to confirm if a similar activity already exists.
- Activity List Display: Display a real-time list of added activities with their names, unclassified badge, and delete option.
- Activity Counter: Display the count of listed activities, updating in real-time.
- Data Persistence: Store and manage activity data in Firestore under the 'rh-dp-activities' key.
- Activity Classification: Categorize each activity to its type (DP | RH | Shared).
- Completion Handoff: After finishing adding the activities, user can signal handoff to next part of the app, for further refinement.

## Style Guidelines:

- Primary color: Strong blue (#2563EB) to represent collaboration and action.
- Background color: Light blue gradient (#E0F7FA) for a soft and inviting feel.
- Accent color: Analogous light purple (#7C3AED) to complement the primary blue while signaling action.
- Body and headline font: 'Inter', a grotesque-style sans-serif font known for its modern, neutral, and objective appearance.
- Use simple, clear icons for activity categories and actions.
- White cards with subtle shadows for the activity list to provide clarity and focus.
- Subtle animations on adding and deleting activities.