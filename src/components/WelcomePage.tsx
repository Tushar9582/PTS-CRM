import React,{useEffect,useState,useRef} from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
 Phone,ArrowRight, Mail, Video as VideoIcon,Rocket,Bot,Mailbox, UserPlus, Database, BarChart2,Server,Cloud,Terminal,ShieldCheck,CreditCard,Check} from "lucide-react";
import {Card,CardContent, CardHeader, CardTitle,} from "@/components/ui/card";
import { motion, useAnimation } from "framer-motion";
import { useInView } from "react-intersection-observer";
import dashboard  from '../assets/dashboard.png'
import leads  from '../assets/leads.png'
import sales  from '../assets/sales.png'
import DownloadButton from "./DownloadButton";
import StickyDownloadButton from "./DownloadButton";

// Animation variants
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const AnimatedCard = ({ children }: { children: React.ReactNode }) => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      variants={item}
    >
      {children}
    </motion.div>
  );
};

const FeatureHighlight = ({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}) => {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="flex flex-col items-center text-center p-6 bg-background rounded-xl border border-border shadow-sm hover:shadow-md transition-all"
    >
      <div
        className={`w-14 h-14 rounded-full ${color} flex items-center justify-center mb-4`}
      >
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </motion.div>
  );
};

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const controls = useAnimation();
  const [activeTab, setActiveTab] = React.useState("monthly");
  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle class
    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;

      constructor(width: number, height: number) {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 3 + 1;
        this.speedX = Math.random() * 2 - 1;
        this.speedY = Math.random() * 2 - 1;
        this.color = `hsl(${Math.random() * 60 + 200}, 80%, 60%)`; // Blueish colors
      }

      update(width: number, height: number) {
        this.x += this.speedX;
        this.y += this.speedY;

        // Bounce off edges
        if (this.x < 0 || this.x > width) this.speedX *= -1;
        if (this.y < 0 || this.y > height) this.speedY *= -1;
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
      }
    }

    // Create particles
    const particles: Particle[] = [];
    const particleCount = window.innerWidth < 768 ? 30 : 80;

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle(canvas.width, canvas.height));
    }

    // Animation loop
    let animationFrameId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.shadowBlur = 0;

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            const opacity = 1 - distance / 150;
            ctx.strokeStyle = `rgba(100, 150, 255, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Update and draw particles
      particles.forEach(particle => {
        particle.update(canvas.width, canvas.height);
        particle.draw(ctx);
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  React.useEffect(() => {
    const sequence = async () => {
      await controls.start("visible");
    };
    sequence();
  }, [controls]);

  const handleDownload = () => {
    // Replace with actual download logic
    console.log("Downloading brochure...");
    // window.location.href = "/path-to-brochure.pdf";
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-background">
      <StickyDownloadButton />
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-background overflow-hidden">
      {/* Full-screen canvas animation */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
      />

      {/* Enhanced gradient overlay */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-80 h-80 rounded-full bg-primary/10 blur-[100px]"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-purple-500/10 blur-[120px]"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] radial-gradient"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 gap-12 items-center">
          <div className="space-y-8 text-center">
            <div className="inline-flex items-center px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium backdrop-blur-sm">
              <Rocket className="h-4 w-4 mr-2" />
              Revolutionizing Lead Management
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              <span className="text-primary">Advanced Lead Management</span>{" "}
              for Modern Businesses
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Automate, nurture, and convert leads with our intelligent
              platform powered by AI and machine learning.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 px-8 py-6 text-lg font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all transform hover:scale-105"
                onClick={() => navigate("/login")}
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
      {/* Trusted By Section */}
      {/* <motion.section
        initial="hidden"
        whileInView="show"
        variants={container}
        viewport={{ once: true }}
        className="bg-background py-12 overflow-hidden"
      >
        <div className="container mx-auto px-4">
          <motion.h2
            variants={item}
            className="text-center text-lg text-muted-foreground mb-8"
          >
            Trusted by leading organizations worldwide
          </motion.h2>

          {/* Mercury-style infinite scrolling logos */}
          {/* <div className="relative w-full overflow-hidden">
            <motion.div
              variants={item}
              className="flex gap-8 w-max"
              animate={{ x: ["0%", "-100%"] }}
              transition={{
                repeat: Infinity,
                duration: 25,
                ease: "linear",
              }}
            >
              {[...Array(10).keys(), ...Array(10).keys()].map((i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.1 }}
                  className="flex-shrink-0 p-6"
                >
                  <img
                    src={`/brand-logo/${(i % 10) + 1}.jpg`}
                    alt={`Brand ${(i % 10) + 1}`}
                    className="h-42 w-64 object-contain grayscale hover:grayscale-0 transition-all"
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div> 
           </motion.section>*/}


      {/* Features Section */}
      {/* <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              Everything You Need to{" "}
              <span className="text-primary">Convert More Leads</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Our platform combines cutting-edge technology with intuitive design
              to supercharge your sales process
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureHighlight
              icon={<Bot className="h-6 w-6 text-white" />}
              title="AI Lead Scoring"
              description="Our AI analyzes lead behavior to prioritize high-intent prospects"
              color="bg-purple-500"
            />
            <FeatureHighlight
              icon={<VideoIcon className="h-6 w-6 text-white" />}
              title="Live Video Chat"
              description="Engage leads in real-time with integrated video conferencing"
              color="bg-blue-500"
            />
            <FeatureHighlight
              icon={<Mailbox className="h-6 w-6 text-white" />}
              title="Auto Email Sequences"
              description="Personalized email nurturing based on lead behavior"
              color="bg-green-500"
            />
            <FeatureHighlight
              icon={<UserPlus className="h-6 w-6 text-white" />}
              title="Lead Generation"
              description="Automatically find and qualify new leads for your business"
              color="bg-orange-500"
            />
          </div>
        </div>
      </section> */}

      {/* Detailed Features Section */}
      <section className="py-20 bg-background relative overflow-hidden mt-32">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              Advanced Lead Management{" "}
              <span className="text-primary">Capabilities</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Comprehensive tools designed to streamline your entire sales funnel
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="order-2 lg:order-1"
            >
              <h3 className="text-2xl md:text-3xl font-bold mb-6">
                Intelligent Lead Capture
              </h3>
              <p className="text-muted-foreground mb-6">
                Automatically capture leads from multiple channels including
                website, social media, and email. Our system qualifies and
                routes leads to the right team member instantly.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <div className="bg-primary/10 p-2 rounded-lg mr-4">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">
                      Centralized Lead Database
                    </h4>
                    <p className="text-muted-foreground">
                      All your leads in one place with detailed profiles and
                      interaction history
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="bg-primary/10 p-2 rounded-lg mr-4">
                    <BarChart2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Real-time Analytics</h4>
                    <p className="text-muted-foreground">
                      Track lead behavior and conversion metrics in real-time
                    </p>
                  </div>
                </li>
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="order-1 lg:order-2"
            >
              <div className="relative rounded-2xl overflow-hidden border border-border shadow-xl">
                <img
                  src={dashboard}
                  alt="Lead Capture Dashboard"
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent"></div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="relative rounded-2xl overflow-hidden border border-border shadow-xl">
                <img
                  src={leads}
                  alt="Lead Nurturing Dashboard"
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent"></div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h3 className="text-2xl md:text-3xl font-bold mb-6">
                Automated Lead Nurturing
              </h3>
              <p className="text-muted-foreground mb-6">
                Our AI-powered nurturing system delivers personalized content at
                exactly the right time to move leads through your funnel
                automatically.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <div className="bg-primary/10 p-2 rounded-lg mr-4">
                    <Server className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">
                      Behavior-based Automation
                    </h4>
                    <p className="text-muted-foreground">
                      Triggers based on lead activity, engagement, and profile
                      data
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="bg-primary/10 p-2 rounded-lg mr-4">
                    <Cloud className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Omnichannel Nurturing</h4>
                    <p className="text-muted-foreground">
                      Engage leads across email, SMS, social media, and more
                    </p>
                  </div>
                </li>
              </ul>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="order-2 lg:order-1"
            >
              <h3 className="text-2xl md:text-3xl font-bold mb-6">
                Sales Conversion Tools
              </h3>
              <p className="text-muted-foreground mb-6">
                Equip your sales team with powerful tools to close deals faster.
                From proposal generation to contract signing, we've got you
                covered.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <div className="bg-primary/10 p-2 rounded-lg mr-4">
                    <Terminal className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">
                      Smart Proposal Generator
                    </h4>
                    <p className="text-muted-foreground">
                      AI-assisted proposals tailored to each lead's needs
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="bg-primary/10 p-2 rounded-lg mr-4">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">E-signature</h4>
                    <p className="text-muted-foreground">
                      Secure digital signatures with full legal compliance
                    </p>
                  </div>
                </li>
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="order-1 lg:order-2"
            >
              <div className="relative rounded-2xl overflow-hidden border border-border shadow-xl">
                <img
                  src={sales}
                  alt="Sales Tools Dashboard"
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent"></div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-r from-primary to-primary/90 text-white">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="show"
            variants={container}
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {[
              { value: "3x", label: "Higher Conversion Rates" },
              { value: "10K+", label: "Businesses Trust Us" },
              { value: "24/7", label: "Customer Support" },
              { value: "98%", label: "Customer Satisfaction" },
            ].map((stat, index) => (
              <motion.div
                key={index}
                variants={item}
                className="text-center p-6"
              >
                <motion.p
                  whileHover={{ scale: 1.1 }}
                  className="text-4xl md:text-5xl font-bold mb-4"
                >
                  {stat.value}
                </motion.p>
                <p className="text-lg opacity-90">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
     <section className="py-20 bg-background relative overflow-hidden">
  <div className="container mx-auto px-4">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="text-center mb-16"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="inline-flex items-center px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4"
      >
        <CreditCard className="h-4 w-4 mr-2" />
        Transparent Pricing
      </motion.div>
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
        Simple, Flexible{" "}
        <span className="text-primary">Pricing Plans</span>
      </h2>
      <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
        Choose the plan that fits your business needs
      </p>
    </motion.div>

    <div className="flex justify-center mb-12">
      <div className="inline-flex bg-secondary rounded-full p-1">
        {["monthly", "yearly", "lifetime"].map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "ghost"}
            className={`rounded-full ${activeTab === tab ? "shadow-md" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Button>
        ))}
      </div>
    </div>

    {/* Pricing Cards - Replacing PricingTabs */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Basic Plan */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-background border rounded-xl shadow-sm hover:shadow-md transition-all"
      >
        <div className="p-6">
          <h3 className="text-2xl font-bold mb-2">Basic</h3>
          <div className="flex items-end mb-4">
            <span className="text-4xl font-bold">
              {activeTab === "monthly" ? "₹1,999" : 
               activeTab === "yearly" ? "₹19,999" : "₹49,999"}
            </span>
            <span className="text-muted-foreground ml-2">
              {activeTab !== "lifetime" ? "/month" : " one-time"}
            </span>
          </div>
          {activeTab === "yearly" && (
            <p className="text-sm text-green-500 mb-4">Save 16%</p>
          )}
          <ul className="space-y-3 mb-6">
            <li className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
              <span>Up to 1,000 leads</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
              <span>Basic lead scoring</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
              <span>Email automation</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
              <span>Standard reports</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
              <span>Email support</span>
            </li>
          </ul>
          <Button onClick={() => navigate("/login")} className="w-full">Get Started</Button>
        </div>
      </motion.div>

      {/* Pro Plan */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-background border-2 border-primary rounded-xl shadow-sm hover:shadow-md transition-all"
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-2xl font-bold">Pro</h3>
            <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
              Popular
            </span>
          </div>
          <div className="flex items-end mb-4">
            <span className="text-4xl font-bold">
              {activeTab === "monthly" ? "₹4,999" : 
               activeTab === "yearly" ? "₹49,999" : "₹1,49,999"}
            </span>
            <span className="text-muted-foreground ml-2">
              {activeTab !== "lifetime" ? "/month" : " one-time"}
            </span>
          </div>
          {activeTab === "yearly" && (
            <p className="text-sm text-green-500 mb-4">Save 17%</p>
          )}
          <ul className="space-y-3 mb-6">
            <li className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
              <span>Up to 5,000 leads</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
              <span>Advanced lead scoring</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
              <span>Multi-channel automation</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
              <span>Advanced analytics</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
              <span>Priority support</span>
            </li>
          </ul>
          <Button onClick={() => navigate("/login")} className="w-full bg-primary hover:bg-primary/90">Get Started</Button>
        </div>
      </motion.div>

      {/* Team Plan */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        onClick={() => navigate("/login")}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-background border rounded-xl shadow-sm hover:shadow-md transition-all"
      >
        <div className="p-6">
          <h3 className="text-2xl font-bold mb-2">Team</h3>
          <div className="flex items-end mb-4">
            <span className="text-4xl font-bold">
              {activeTab === "monthly" ? "₹9,999" : 
               activeTab === "yearly" ? "₹99,999" : "₹2,99,999"}
            </span>
            <span className="text-muted-foreground ml-2">
              {activeTab !== "lifetime" ? "/month" : " one-time"}
            </span>
          </div>
          {activeTab === "yearly" && (
            <p className="text-sm text-green-500 mb-4">Save 17%</p>
          )}
          <ul className="space-y-3 mb-6">
            <li className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
              <span>Up to 20,000 leads</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
              <span>AI-powered scoring</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
              <span>Video chat integration</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
              <span>Custom reporting</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-primary mr-2 mt-0.5" />
              <span>Dedicated account manager</span>
            </li>
          </ul>
          <Button className="w-full">Get Started</Button>
        </div>
      </motion.div>
    </div>
  </div>
</section>

      {/* Testimonials */}
     <section className="py-20 bg-secondary/10 relative overflow-hidden">
  <div className="absolute inset-0 z-0">
    <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid-pattern.svg')] opacity-5"></div>
  </div>

  <div className="container mx-auto px-4 relative z-10">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="text-center mb-16"
    >
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
        What Our Customers Say
      </h2>
      <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
        Don't just take our word for it. Here's what our customers say about us.
      </p>
    </motion.div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {/* Testimonial 1 */}
      <div className="bg-background p-8 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center mb-4">
          {[...Array(5)].map((_, i) => (
            <span key={i} className="text-yellow-400 text-xl mr-1">★</span>
          ))}
        </div>
        <p className="text-lg italic mb-6">
          "This platform has transformed our lead management process..."
        </p>
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mr-4">
            <span className="text-lg font-bold text-primary">RK</span>
          </div>
          <div>
            <h4 className="font-semibold">Rajesh Kumar</h4>
            <p className="text-muted-foreground text-sm">CEO, TechSolutions India</p>
          </div>
        </div>
      </div>

      {/* Testimonial 2 */}
      <div className="bg-background p-8 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center mb-4">
          {[...Array(5)].map((_, i) => (
            <span key={i} className="text-yellow-400 text-xl mr-1">★</span>
          ))}
        </div>
        <p className="text-lg italic mb-6">
          "The AI lead scoring is incredibly accurate..."
        </p>
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mr-4">
            <span className="text-lg font-bold text-primary">PS</span>
          </div>
          <div>
            <h4 className="font-semibold">Priya Sharma</h4>
            <p className="text-muted-foreground text-sm">Sales Director</p>
          </div>
        </div>
      </div>

      {/* Testimonial 3 */}
      <div className="bg-background p-8 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center mb-4">
          {[...Array(5)].map((_, i) => (
            <span key={i} className="text-yellow-400 text-xl mr-1">★</span>
          ))}
        </div>
        <p className="text-lg italic mb-6">
          "The automated nurturing sequences save us countless hours..."
        </p>
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mr-4">
            <span className="text-lg font-bold text-primary">AP</span>
          </div>
          <div>
            <h4 className="font-semibold">Amit Patel</h4>
            <p className="text-muted-foreground text-sm">Marketing Manager</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

      {/* CTA Section */}
      <section className="py-28 bg-gradient-to-r from-primary to-primary/80 text-white relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid-pattern.svg')] opacity-10"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-white/5 blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-background/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 md:p-12 max-w-4xl mx-auto"
          >
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-bold mb-6"
            >
              Ready to Transform Your Lead Management?
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              viewport={{ once: true }}
              className="text-xl mb-8 max-w-2xl mx-auto"
            >
              Join thousands of businesses growing faster with our platform
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              viewport={{ once: true }}
              className="flex flex-col sm:flex-row justify-center gap-4"
            >
              <Button
                onClick={() => navigate("/register")}
                className="bg-white text-primary hover:bg-white/90 px-8 py-6 text-lg font-semibold hover:scale-105 transition-transform"
                size="lg"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/demo")}
                className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg font-semibold hover:scale-105 transition-transform"
                size="lg"
              >
                Request Demo
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              viewport={{ once: true }}
              className="mt-6 text-sm text-white/80"
            >
              No credit card required • 14-day free trial • Cancel anytime
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-background relative overflow-hidden">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Everything you need to know about our platform
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            variants={container}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            {[
              {
                question: "How does the AI lead scoring work?",
                answer:
                  "Our AI analyzes hundreds of data points including lead behavior, engagement patterns, firmographics, and demographics to predict conversion likelihood. It continuously learns from your historical data to improve accuracy.",
              },
              {
                question: "Can I integrate with my existing CRM?",
                answer:
                  "Yes, we offer seamless integrations with all major CRMs including Salesforce, HubSpot, Zoho, and more. Our API also allows for custom integrations with any system.",
              },
              {
                question: "What kind of support do you offer?",
                answer:
                  "We provide 24/7 email and chat support for all plans. Premium plans include phone support and a dedicated account manager. All customers get access to our extensive knowledge base and video tutorials.",
              },
              {
                question: "Is my data secure with your platform?",
                answer:
                  "Absolutely. We use enterprise-grade security including end-to-end encryption, regular backups, and SOC 2 Type II compliance. Your data is always yours and we never sell or share it with third parties.",
              },
              {
                question: "How quickly can I get started?",
                answer:
                  "You can be up and running in minutes with our self-service onboarding. For enterprise customers, we offer white-glove onboarding with typical implementations completed in 1-2 weeks.",
              },
            ].map((faq, index) => (
              <motion.div
                key={index}
                variants={item}
                className="mb-6 last:mb-0"
              >
                <Card className="hover:shadow-lg transition-all">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-lg">{faq.question}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary py-16 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
            <div>
              <h3 className="font-bold text-lg mb-4">Product</h3>
              <ul className="space-y-3">
                {[
                  "Features",
                  "Pricing",
                  "Integrations",
                  "Roadmap",
                  "Changelog",
                ].map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4">Solutions</h3>
              <ul className="space-y-3">
                {[
                  "Small Business",
                  "Enterprise",
                  "Marketing Teams",
                  "Sales Teams",
                  "Startups",
                ].map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4">Resources</h3>
              <ul className="space-y-3">
                {[
                  "Blog",
                  "Help Center",
                  "Webinars",
                  "Templates",
                  "API Docs",
                ].map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4">Company</h3>
              <ul className="space-y-3">
                {["About Us", "Careers", "Contact", "Press", "Partners"].map(
                  (item) => (
                    <li key={item}>
                      <a
                        href="#"
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        {item}
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4">Connect</h3>
              <div className="flex space-x-4 mb-6">
                {["Twitter", "LinkedIn", "Facebook", "YouTube"].map((social) => (
                  <a
                    key={social}
                    href="#"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {social}
                  </a>
                ))}
              </div>
              <div className="space-y-3">
                <div className="flex items-center text-muted-foreground">
                  <Mail className="h-4 w-4 mr-2" />
                  <span>support@leadmanager.com</span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Phone className="h-4 w-4 mr-2" />
                  <span>+91 98765 43210</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center">
            <p className="text-muted-foreground text-sm">
              &copy; {new Date().getFullYear()} Lead Management System. All
              rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a
                href="#"
                className="text-muted-foreground hover:text-primary text-sm transition-colors"
              >
                Privacy
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-primary text-sm transition-colors"
              >
                Terms
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-primary text-sm transition-colors"
              >
                Cookies
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WelcomePage;