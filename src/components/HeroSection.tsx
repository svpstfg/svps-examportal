import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, BookOpen, Target, TrendingUp } from "lucide-react";

interface HeroSectionProps {
  onGetStarted: () => void;
}

export const HeroSection = ({ onGetStarted }: HeroSectionProps) => {
  return (
    <section className="py-20 bg-gradient-to-br from-background via-background to-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-education-purple bg-clip-text text-transparent">
            Transform Your Testing Experience
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
            Create comprehensive mock tests with advanced features, detailed explanations, and real-time analytics. 
            Perfect for teachers and students seeking excellence in education.
          </p>
          <Button 
            size="lg" 
            className="animate-pulse-glow"
            onClick={onGetStarted}
          >
            Get Started Today
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up">
          <Card className="p-6 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Timed Tests</h3>
            <p className="text-sm text-muted-foreground">
              Set custom timers for realistic exam conditions
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-6 w-6 text-accent" />
            </div>
            <h3 className="font-semibold mb-2">Rich Explanations</h3>
            <p className="text-sm text-muted-foreground">
              Add images and detailed explanations for each question
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 bg-education-green/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Target className="h-6 w-6 text-education-green" />
            </div>
            <h3 className="font-semibold mb-2">Chapter Organization</h3>
            <p className="text-sm text-muted-foreground">
              Organize tests by chapters and subjects
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 bg-education-purple/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="h-6 w-6 text-education-purple" />
            </div>
            <h3 className="font-semibold mb-2">Instant Results</h3>
            <p className="text-sm text-muted-foreground">
              Get detailed performance analytics immediately
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
};