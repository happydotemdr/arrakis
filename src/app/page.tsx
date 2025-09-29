import { MessageSquare, Database, Zap } from 'lucide-react'

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-primary mb-4">
            Welcome to Arrakis
          </h1>
          <p className="text-xl text-muted-foreground">
            A modern conversation persistence system built with Next.js 15, React 19, and tRPC
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="text-center p-6 border rounded-lg hover:shadow-lg transition-shadow">
            <MessageSquare className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Conversation Management</h3>
            <p className="text-muted-foreground">
              Persistent storage and retrieval of conversation histories
            </p>
          </div>

          <div className="text-center p-6 border rounded-lg hover:shadow-lg transition-shadow">
            <Database className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Database Integration</h3>
            <p className="text-muted-foreground">
              PostgreSQL with Prisma ORM for robust data management
            </p>
          </div>

          <div className="text-center p-6 border rounded-lg hover:shadow-lg transition-shadow">
            <Zap className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Modern Stack</h3>
            <p className="text-muted-foreground">
              Built with the latest versions of Next.js, React, and TypeScript
            </p>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-2xl font-semibold mb-4">Getting Started</h2>
          <div className="space-y-4 text-muted-foreground">
            <div className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                1
              </span>
              <div>
                <p className="font-medium text-foreground">Set up your database</p>
                <p>Configure your PostgreSQL connection in .env.local</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                2
              </span>
              <div>
                <p className="font-medium text-foreground">Initialize Prisma</p>
                <p>Run database migrations and generate the Prisma client</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                3
              </span>
              <div>
                <p className="font-medium text-foreground">Start building</p>
                <p>Begin implementing your conversation persistence features</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}