import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Facebook, Instagram, Linkedin, Twitter, Link2 } from "lucide-react";

export const SocialMediaSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-bold">Social Media Integration</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Connect your social media accounts to capture leads, reply to messages, and track campaigns directly from the CRM.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Facebook */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Facebook className="w-5 h-5 text-blue-600" />
              Facebook
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Connect your Facebook pages and manage messages and comments.
            </p>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              Connect Facebook
            </Button>
          </CardContent>
        </Card>

        {/* Instagram */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Instagram className="w-5 h-5 text-pink-500" />
              Instagram
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Connect your Instagram business account for DM management.
            </p>
            <Button className="w-full bg-pink-500 hover:bg-pink-600 text-white">
              Connect Instagram
            </Button>
          </CardContent>
        </Card>

        {/* LinkedIn */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Linkedin className="w-5 h-5 text-blue-700" />
              LinkedIn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Connect LinkedIn for lead generation and message management.
            </p>
            <Button className="w-full bg-blue-700 hover:bg-blue-800 text-white">
              Connect LinkedIn
            </Button>
          </CardContent>
        </Card>

        {/* Twitter */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Twitter className="w-5 h-5 text-sky-500" />
              Twitter (X)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Connect Twitter to manage DMs and track mentions.
            </p>
            <Button className="w-full bg-sky-500 hover:bg-sky-600 text-white">
              Connect Twitter
            </Button>
          </CardContent>
        </Card>

        {/* Other Platforms */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="w-5 h-5 text-gray-600" />
              Other Platforms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Connect additional platforms like WhatsApp, Telegram, etc.
            </p>
            <Button variant="outline" className="w-full">
              View All Platforms
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Connected Accounts Section */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Connected Accounts</h3>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              <Link2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No social media accounts connected yet</p>
              <p className="text-sm mt-1">Connect your first account to get started</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};