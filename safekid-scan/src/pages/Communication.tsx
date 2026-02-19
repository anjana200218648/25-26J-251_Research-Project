import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Users, MessageSquare, Phone, Mail, Calendar, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

const Communication = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="container mx-auto px-4 py-8 sm:px-6">
        {/* Back Button */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-green-100 rounded-full">
              <Users className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Parent-Teacher Communication</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Build strong partnerships with educators to ensure comprehensive child safety both at home and school
          </p>
        </div>

        {/* Communication Methods */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardHeader>
              <div className="p-3 bg-blue-100 rounded-full w-fit mb-4">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-xl font-semibold">Email Communication</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Use school email system</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Be clear and concise</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Include specific concerns</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Request read receipts</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardHeader>
              <div className="p-3 bg-green-100 rounded-full w-fit mb-4">
                <Phone className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-xl font-semibold">Phone Calls</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Schedule appointments</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Prepare discussion points</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Take notes during calls</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Follow up with email</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardHeader>
              <div className="p-3 bg-purple-100 rounded-full w-fit mb-4">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle className="text-xl font-semibold">Parent-Teacher Conferences</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Attend regularly scheduled meetings</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Request additional meetings if needed</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Share relevant information</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Discuss safety concerns openly</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Communication Strategies */}
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-gray-900">Effective Communication Strategies</CardTitle>
              <CardDescription>Build strong relationships with your child's educators</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">What to Share</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li>• Online safety concerns you've noticed</li>
                    <li>• Changes in your child's behavior</li>
                    <li>• Home internet usage patterns</li>
                    <li>• Your family's technology rules</li>
                    <li>• Resources you're using at home</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">What to Ask</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li>• School's digital safety policies</li>
                    <li>• Online safety education curriculum</li>
                    <li>• How they monitor student activity</li>
                    <li>• Incident reporting procedures</li>
                    <li>• Available support resources</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-gray-900">Sample Conversation Starters</CardTitle>
              <CardDescription>Ready-to-use phrases for different situations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Initial Contact</h4>
                    <p className="text-sm text-blue-800 italic">
                      "I'm reaching out because I'm concerned about my child's online safety. I'd like to discuss how we can work together to keep them safe both at home and at school."
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-900 mb-2">Sharing Information</h4>
                    <p className="text-sm text-green-800 italic">
                      "I've noticed my child spending more time online lately. Have you seen any changes in their behavior or focus during school?"
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-900 mb-2">Requesting Support</h4>
                    <p className="text-sm text-purple-800 italic">
                      "Could you recommend some resources or strategies for teaching my child about online safety? I'd appreciate any guidance you can provide."
                    </p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-orange-900 mb-2">Following Up</h4>
                    <p className="text-sm text-orange-800 italic">
                      "Thank you for our discussion. I'd like to follow up on the online safety measures we talked about. How is that going?"
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-yellow-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-yellow-100 rounded-full">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Important Reminder</h3>
                  <p className="text-gray-700">
                    Always document your communications with teachers, especially regarding safety concerns.
                    Keep records of emails, meeting notes, and any agreements made about your child's online safety.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate('/profile')}
              className="bg-green-600 hover:bg-green-700"
            >
              Update Contact Information
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/resources/safety-guide')}
            >
              View Safety Guide
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Communication;