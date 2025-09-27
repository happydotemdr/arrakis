import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to sessions (main dashboard page)
  redirect('/sessions')
}
