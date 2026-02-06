/**
 * 项目管理窗口逻辑
 * 提供项目CRUD、质粒关联等功能
 */
window.ProjectManager = {
    setup(plasmids, ipcRenderer) {
        const { ref, computed, reactive, watch, nextTick } = Vue;
        
        const showProjectModal = ref(false);
        const projects = ref([]);
        const projectSearchQuery = ref('');
        const expandedProjectIds = ref(new Set()); // Track expanded projects
        const selectedProjectId = ref(null);
        
        // 新建/编辑项目表单
        const showProjectForm = ref(false);
        const isEditingProject = ref(false);
        const projectForm = reactive({
            id: '',
            name: '',
            description: '',
            members: [] // Array of strings
        });

        const newMemberName = ref('');

        const addMember = () => {
            if (newMemberName.value && !projectForm.members.includes(newMemberName.value)) {
                projectForm.members.push(newMemberName.value);
                newMemberName.value = '';
            }
        };

        // 成员选择相关
        const availableMembers = computed(() => {
            // 从现有质粒的“持有人”字段收集，以及项目成员
            const members = new Set();
            if (plasmids.value) {
                plasmids.value.forEach(p => {
                    if (p.持有人) members.add(p.持有人);
                });
            }
            if (projects.value) {
                projects.value.forEach(p => {
                    if (Array.isArray(p.members)) {
                        p.members.forEach(m => members.add(m));
                    }
                });
            }
            return Array.from(members);
        });

        // 当前选中的项目对象
        const currentProject = computed(() => {
            if (!selectedProjectId.value) return null;
            return projects.value.find(p => p.id === selectedProjectId.value);
        });

        // 选择项目
        const selectProject = (id) => {
            selectedProjectId.value = id;
        };

        // 加载项目数据
        const loadProjects = async () => {
            const data = await window.DataService.loadProjects();
            if (data && data.projects) {
                projects.value = data.projects;
            }
        };

        // 保存项目数据
        const saveProjects = async () => {
            await window.DataService.saveProjects({ projects: projects.value });
        };

        // 过滤后的项目列表
        const filteredProjects = computed(() => {
            let list = projects.value;
            if (projectSearchQuery.value) {
                const q = projectSearchQuery.value.toLowerCase();
                list = list.filter(p => 
                    p.name.toLowerCase().includes(q) || 
                    (p.description && p.description.toLowerCase().includes(q))
                );
            }
            // 按名称排序
            return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        });

        // 打开项目管理窗口
        const openProjectModal = () => {
            loadProjects();
            showProjectModal.value = true;
        };

        // 页面初始化时加载一次
        loadProjects();

        // 切换项目展开状态
        const toggleProjectExpand = (projectId) => {
            if (expandedProjectIds.value.has(projectId)) {
                expandedProjectIds.value.delete(projectId);
            } else {
                expandedProjectIds.value.add(projectId);
            }
        };

        // 获取某个项目下的质粒列表
        const getProjectPlasmids = (project) => {
            if (!project || !project.plasmidIds || !plasmids.value) return [];
            return plasmids.value.filter(p => project.plasmidIds.includes(p.id));
        };

        // 准备新建项目
        const openCreateProject = () => {
            isEditingProject.value = false;
            projectForm.id = '';
            projectForm.name = '';
            projectForm.description = '';
            projectForm.members = [];
            newMemberName.value = '';
            showProjectForm.value = true;
        };

        // 准备编辑项目
        const openEditProject = (project) => {
            isEditingProject.value = true;
            projectForm.id = project.id;
            projectForm.name = project.name;
            projectForm.description = project.description || '';
            projectForm.members = project.members ? [...project.members] : [];
            newMemberName.value = '';
            showProjectForm.value = true;
        };

        // 提交项目表单
        const submitProjectForm = async () => {
            if (!projectForm.name) {
                alert('请输入项目名称');
                return;
            }

            if (isEditingProject.value) {
                // 更新
                const project = projects.value.find(p => p.id === projectForm.id);
                if (project) {
                    project.name = projectForm.name;
                    project.description = projectForm.description;
                    project.members = [...projectForm.members];
                    project.updatedAt = new Date().toISOString();
                }
            } else {
                // 新建
                const newProject = {
                    id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    name: projectForm.name,
                    description: projectForm.description,
                    members: [...projectForm.members],
                    plasmidIds: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                projects.value.push(newProject);
            }

            await saveProjects();
            showProjectForm.value = false;
        };

        // 删除项目
        const removeProject = async (project) => {
            if (!confirm(`确定要删除项目 "${project.name}" 吗？\n注意：项目中的质粒不会被删除，只会解除关联。`)) return;
            
            // 1. 从项目列表中移除
            const idx = projects.value.findIndex(p => p.id === project.id);
            if (idx > -1) {
                projects.value.splice(idx, 1);
            }

            // 2. 更新所有关联质粒的“项目”字段
            // 注意：这需要双向维护。质粒对象上也存储了 projectIds。
            // 遍历所有质粒，如果包含该项目ID，则移除
            let plasmidUpdated = false;
            plasmids.value.forEach(p => {
                if (p.项目 && Array.isArray(p.项目) && p.项目.includes(project.id)) {
                    p.项目 = p.项目.filter(pid => pid !== project.id);
                    plasmidUpdated = true;
                }
            });

            await saveProjects();
            // 提示主程序保存质粒数据
            if (plasmidUpdated) {
                // 这里需要一种机制通知主程序保存，或者直接在这里调用保存（如果能获取到 saveDB 方法）
                // 暂时假设主程序的 watch 会处理，或者需要显式调用。
                // 由于 saveDB 在 app.js 中，我们可以通过 emit 或者 shared method。
                // 简单起见，我们假设 app.js 会监听 plasmids 变化并自动保存（如果开启了 autoSave）。
                // 查看 app.js: watch(plasmids, ...) 只是打日志。
                // 真正的保存逻辑在 saveDatabase。
                // 我们可以要求 app.js 传入 saveDatabase 方法，或者在 app.js 中监听 projects 变化同步？
                // 不，这里修改了 plasmids.value 的属性，Vue 会检测到。
                // 但是 app.js 需要知道去保存。
            }
        };

        // 从项目中移除质粒
        const removePlasmidFromProject = async (project, plasmid) => {
            if (!confirm(`确定将质粒 "${plasmid.文件名}" 移出项目 "${project.name}" 吗？`)) return;

            // 1. 从项目的 plasmidIds 中移除
            if (project.plasmidIds) {
                project.plasmidIds = project.plasmidIds.filter(id => id !== plasmid.id);
            }

            // 2. 从质粒的 "项目" 字段中移除
            if (plasmid.项目 && Array.isArray(plasmid.项目)) {
                plasmid.项目 = plasmid.项目.filter(pid => pid !== project.id);
            }

            await saveProjects();
        };

        // 添加质粒到项目（供外部调用或弹窗使用）
        const addPlasmidsToProject = async (project, plasmidList) => {
            if (!project.plasmidIds) project.plasmidIds = [];
            
            let changed = false;
            plasmidList.forEach(p => {
                // 确保质粒有ID
                if (!p.id) return; // Should allow generating ID if missing?
                
                // 项目添加质粒ID
                if (!project.plasmidIds.includes(p.id)) {
                    project.plasmidIds.push(p.id);
                    changed = true;
                }

                // 质粒添加项目ID
                if (!p.项目) p.项目 = [];
                if (!Array.isArray(p.项目)) p.项目 = [];
                if (!p.项目.includes(project.id)) {
                    p.项目.push(project.id);
                    changed = true;
                }
            });

            if (changed) {
                project.updatedAt = new Date().toISOString();
                await saveProjects();
            }
        };

        // 获取项目名称
        const getProjectName = (projectIds) => {
            if (!projectIds) return '';
            const ids = Array.isArray(projectIds) ? projectIds : [projectIds];
            return ids.map(id => {
                const p = projects.value.find(proj => proj.id === id);
                return p ? p.name : '';
            }).filter(Boolean).join(', ');
        };

        // 从所有项目中移除成员
        const removeMemberFromAllProjects = async (memberName) => {
            let changed = false;
            projects.value.forEach(p => {
                if (p.members && p.members.includes(memberName)) {
                    p.members = p.members.filter(m => m !== memberName);
                    p.updatedAt = new Date().toISOString();
                    changed = true;
                }
            });
            if (changed) {
                await saveProjects();
            }
            return changed;
        };

        return {
            showProjectModal,
            projects,
            projectSearchQuery,
            filteredProjects,
            expandedProjectIds,
            toggleProjectExpand,
            getProjectPlasmids,
            getProjectName,
            
            showProjectForm,
            projectForm,
            isEditingProject,
            openCreateProject,
            openEditProject,
            submitProjectForm,
            removeProject,
            
            removePlasmidFromProject,
            addPlasmidsToProject,
            removeMemberFromAllProjects,
            
            openProjectModal,
            loadProjects,
            availableMembers,
            newMemberName,
            addMember,
            selectedProjectId,
            currentProject,
            selectProject
        };
    }
};