import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Edit, Trash2, FolderOpen, Users } from "lucide-react";
import { toast } from "sonner";
import { Class, Course } from "@/types";

interface CourseManagementProps {
  classes: Class[];
  courses: Course[];
  onCourseCreate: (course: Course) => void;
  onCourseUpdate: (course: Course) => void;
  onCourseDelete: (courseId: string) => void;
}

export const CourseManagement = ({ 
  classes, 
  courses, 
  onCourseCreate, 
  onCourseUpdate, 
  onCourseDelete 
}: CourseManagementProps) => {
  const [newCourse, setNewCourse] = useState({
    name: '',
    description: '',
    classId: ''
  });

  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const handleCreateCourse = () => {
    if (!newCourse.name.trim() || !newCourse.classId) {
      toast.error("Course name and class selection are required");
      return;
    }

    const courseToCreate: Course = {
      id: Date.now().toString(),
      name: newCourse.name,
      description: newCourse.description,
      classId: newCourse.classId,
      chapterCount: 0,
      createdAt: new Date()
    };

    onCourseCreate(courseToCreate);
    setNewCourse({ name: '', description: '', classId: '' });
    toast.success("Course created successfully!");
  };

  const handleUpdateCourse = () => {
    if (!editingCourse || !editingCourse.name.trim()) {
      toast.error("Course name is required");
      return;
    }

    onCourseUpdate(editingCourse);
    setEditingCourse(null);
    toast.success("Course updated successfully!");
  };

  const handleDeleteCourse = (courseId: string) => {
    const course = courses.find((c) => c.id === courseId);
    if (course && course.chapterCount > 0) {
      toast.error("Remove all chapters before deleting this subject.");
      return;
    }
    if (window.confirm("Are you sure you want to delete this subject? This action cannot be undone.")) {
      onCourseDelete(courseId);
      toast.success("Subject deleted successfully!");
    }
  };

  const getClassName = (classId: string) => {
    return classes.find(cls => cls.id === classId)?.name || "Unknown Class";
  };

  const groupCoursesByClass = () => {
    const grouped: { [key: string]: Course[] } = {};
    courses.forEach(course => {
      if (!grouped[course.classId]) {
        grouped[course.classId] = [];
      }
      grouped[course.classId].push(course);
    });
    return grouped;
  };

  const groupedCourses = groupCoursesByClass();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5" />
            <span>Create New Course</span>
          </CardTitle>
          <CardDescription>
            Create a course within a specific class to organize chapters and tests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="course-name">Course Name</Label>
              <Input
                id="course-name"
                value={newCourse.name}
                onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                placeholder="e.g., Advanced Mathematics"
              />
            </div>
            <div>
              <Label htmlFor="course-description">Description</Label>
              <Input
                id="course-description"
                value={newCourse.description}
                onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                placeholder="Course description"
              />
            </div>
            <div>
              <Label htmlFor="course-class">Select Class</Label>
              <Select value={newCourse.classId} onValueChange={(value) => setNewCourse({ ...newCourse, classId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span>{cls.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleCreateCourse}>
            <Plus className="h-4 w-4 mr-2" />
            Create Course
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FolderOpen className="h-5 w-5" />
            <span>Your Courses</span>
          </CardTitle>
          <CardDescription>
            Manage all courses organized by class
          </CardDescription>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No courses created yet</p>
              <p className="text-sm text-muted-foreground">Create your first course to get started</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedCourses).map(([classId, classCourses]) => {
                const className = getClassName(classId);
                return (
                  <div key={classId} className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">{className}</h3>
                      <Badge variant="outline">
                        {classCourses.length} course{classCourses.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 ml-6">
                      {classCourses.map((course) => (
                        <Card key={course.id} className="hover:shadow-md transition-shadow">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg">{course.name}</CardTitle>
                                <CardDescription className="mt-1">
                                  {course.description || "No description"}
                                </CardDescription>
                              </div>
                              <div className="flex space-x-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingCourse(course)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={course.chapterCount > 0}
                                  title={
                                    course.chapterCount > 0
                                      ? "Remove all chapters before deleting this subject"
                                      : "Delete subject"
                                  }
                                  onClick={() => handleDeleteCourse(course.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary">
                                {course.chapterCount} chapters
                              </Badge>
                              <div className="text-xs text-muted-foreground">
                                Created {course.createdAt.toLocaleDateString()}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Course Dialog */}
      {editingCourse && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Course</CardTitle>
            <CardDescription>Update course information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-course-name">Course Name</Label>
                <Input
                  id="edit-course-name"
                  value={editingCourse.name}
                  onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-course-description">Description</Label>
                <Input
                  id="edit-course-description"
                  value={editingCourse.description}
                  onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleUpdateCourse}>
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setEditingCourse(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};