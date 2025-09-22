import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Brain, Camera, Scale, Heart, Moon, TrendingUp, ArrowRight, Sparkles, Target, Users, Github } from "lucide-react"
import { WeightProgressChart, CalorieIntakeChart, MoodSleepChart } from "@/components/dashboard-preview"

/**
 * Displays the main landing page for the AI Fitness Coach app, featuring navigation, hero section with dashboard previews, feature highlights, value proposition, call to action, and footer.
 *
 * Presents a multi-section, responsive layout introducing the app’s capabilities, benefits, and community focus using custom UI components, charts, and icons.
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      {/* Navigation */}
      <nav className="border-b border-border/20 bg-background/10 backdrop-blur-2xl sticky top-0 z-50 supports-[backdrop-filter]:bg-background/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">AI Fitness Coach</span>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/features" className="text-muted-foreground hover:text-foreground transition-colors">
                Features
              </Link>
              <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
                About
              </Link>
              <Link href="/app/profile" className="text-muted-foreground hover:text-foreground transition-colors">
                Profile
              </Link>
              <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </Link>
              <Button asChild>
                <Link href="https://github.com/edgarcerecerez/ai-fitness-coach" className="flex items-center gap-2">
                  <Github className="w-5 h-5" />
                  <span>Star on GitHub</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 relative overflow-hidden">
        {/* Background Video */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        >
          <source src="/images/workout-background.mp4" type="video/mp4" />
        </video>
        {/* Lighter overlay to ensure text readability */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(10,16,30,0.6),rgba(12,18,33,0.5)_45%,rgba(4,7,16,0.65)_100%)]"></div>
        <div className="absolute -top-48 left-1/2 h-[28rem] w-[35rem] -translate-x-1/2 bg-white/20 blur-3xl opacity-70"></div>
        <div className="absolute bottom-[-6rem] right-[-4rem] h-72 w-72 bg-purple-400/30 blur-3xl rounded-full opacity-80"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <Badge variant="secondary" className="glass-badge mb-6">
            <Sparkles className="w-4 h-4 mr-2" />
            AI-Powered Fitness Coaching
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Your Personal AI Fitness Coach for{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Real Results
            </span>
          </h1>
          <p className="text-xl text-slate-200 mb-8 max-w-3xl mx-auto leading-relaxed">
            Transform your health journey with intelligent recommendations that adapt to your lifestyle. Track weight,
            calories, sleep, and mood while our AI provides personalized guidance for sustainable success.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button
              size="lg"
              className="glass-button text-lg px-10 py-6 rounded-full font-semibold tracking-wide"
              asChild
            >
              <Link href="/login">
                Start Your Journey
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="glass-button-outline text-lg px-10 py-6 rounded-full text-white/90"
              asChild
            >
              <Link href="/features">Explore Features</Link>
            </Button>
          </div>

          {/* Hero Dashboard Preview */}
          <div className="relative max-w-4xl mx-auto">
            <div className="glass-panel p-8 md:p-10">
              <div className="relative z-10 mb-6">
                <div className="flex flex-col gap-2 text-left">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.2em] text-white/80 backdrop-blur-xl">
                    <Users className="w-4 h-4" />
                    Live Dashboard Preview
                  </span>
                  <h3 className="text-2xl font-semibold text-white">Your AI Fitness Dashboard</h3>
                  <p className="text-sm text-white/70">
                    A glimpse of the intelligence guiding your workouts, recovery, and nutrition.
                  </p>
                </div>
              </div>

              {/* Big component on top - Weight Progress Chart */}
              <div className="mb-6">
                <WeightProgressChart variant="glass" />
              </div>

              {/* Two small components on bottom */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CalorieIntakeChart variant="glass" />
                <MoodSleepChart variant="glass" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Everything You Need for Success</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our holistic approach combines cutting-edge AI with comprehensive health tracking to deliver personalized
              recommendations that actually work.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Camera className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Smart Calorie Tracking</h3>
                <p className="text-muted-foreground">
                  Simply take a photo of your meal and our AI instantly estimates calories and nutritional content. No
                  more tedious manual logging.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-chart-2/20 rounded-lg flex items-center justify-center mb-4">
                  <Scale className="w-6 h-6 text-chart-2" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Seamless Weight Tracking</h3>
                <p className="text-muted-foreground">
                  Connect your smart scale or Apple HealthKit for automatic weight tracking with intelligent trend
                  analysis and progress visualization.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-chart-3/20 rounded-lg flex items-center justify-center mb-4">
                  <Brain className="w-6 h-6 text-chart-3" />
                </div>
                <h3 className="text-xl font-semibold mb-3">AI-Powered Insights</h3>
                <p className="text-muted-foreground">
                  Get personalized recommendations based on your weight, nutrition, sleep, and mood patterns. Your AI
                  coach learns what works for you.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-chart-4/20 rounded-lg flex items-center justify-center mb-4">
                  <Heart className="w-6 h-6 text-chart-4" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Holistic Health Tracking</h3>
                <p className="text-muted-foreground">
                  Track mood, stress levels, and life events alongside physical metrics for a complete picture of your
                  health journey.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-chart-5/20 rounded-lg flex items-center justify-center mb-4">
                  <Moon className="w-6 h-6 text-chart-5" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Sleep Integration</h3>
                <p className="text-muted-foreground">
                  Monitor sleep patterns and receive recommendations that consider your rest quality for optimal
                  recovery and performance.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-chart-1/20 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-chart-1" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Progress Analytics</h3>
                <p className="text-muted-foreground">
                  Visualize your progress with intelligent analytics that highlight trends, celebrate milestones, and
                  keep you motivated.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-4">
                <Target className="w-4 h-4 mr-2" />
                Your Success First
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Built for Real People, Real Results
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Unlike other fitness apps focused on monetization, we&apos;re committed to your genuine success. Our AI
                analyzes your unique patterns and provides actionable insights that fit your lifestyle.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start">
                  <div className="w-6 h-6 bg-chart-2/20 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <div className="w-2 h-2 bg-chart-2 rounded-full"></div>
                  </div>
                  <span className="text-foreground">Personalized recommendations that evolve with you</span>
                </li>
                <li className="flex items-start">
                  <div className="w-6 h-6 bg-chart-2/20 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <div className="w-2 h-2 bg-chart-2 rounded-full"></div>
                  </div>
                  <span className="text-foreground">Minimal friction tracking with maximum insights</span>
                </li>
                <li className="flex items-start">
                  <div className="w-6 h-6 bg-chart-2/20 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <div className="w-2 h-2 bg-chart-2 rounded-full"></div>
                  </div>
                  <span className="text-foreground">Focus on sustainable habits, not quick fixes</span>
                </li>
              </ul>
              <Button size="lg" asChild>
                <Link href="/about">
                  Learn More About Our Mission
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            </div>
            <div className="relative">
              <div className="bg-white rounded-2xl p-8 shadow-2xl">
                <Image
                  src="/placeholder.svg?height=500&width=600"
                  alt="AI Fitness Coach Features"
                  width={600}
                  height={500}
                  className="rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-secondary">
        <div className="container mx-auto text-center">
          <Badge variant="outline" className="mb-6 border-muted-foreground/20 bg-muted/50 text-muted-foreground">
            <Users className="w-4 h-4 mr-2" />
            Open Source & Community Driven
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-foreground mb-6">Ready to Transform Your Health Journey?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join our community of health-focused individuals and start building sustainable habits with the power of AI
            coaching.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="/signup">
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6"
              asChild
            >
              <Link href="/contribute">Contribute to the Project</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted text-muted-foreground py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
                  <Brain className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground">AI Fitness Coach</span>
              </div>
              <p className="text-muted-foreground">
                Your personal AI-powered fitness companion for sustainable health and wellness.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-4">Product</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/features" className="hover:text-foreground transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-foreground transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/integrations" className="hover:text-foreground transition-colors">
                    Integrations
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-4">Company</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/about" className="hover:text-foreground transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/contribute" className="hover:text-foreground transition-colors">
                    Contribute
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-foreground transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-4">Support</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/help" className="hover:text-foreground transition-colors">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-foreground transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-foreground transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-muted-foreground">
            <p>&copy; 2024 AI Fitness Coach. Open source and built with ❤️ for your success.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
