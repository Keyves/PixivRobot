import * as types from './types'
import store from './index'
import { remote, ipcRenderer } from 'electron'

export const changeAuthorId = ({dispatch}, value) => {
	dispatch(types.CHANGE_AUTHORID, value)
}

export const changeDownloadPath = ({dispatch}, preDownloadPath) => {
	const downloadPath = remote.dialog.showOpenDialog({
		defaultPath: preDownloadPath,
		properties: [ 'openDirectory', 'createDirectory' ]
	})
	//若选取了路径则修改，否则不变
	if (downloadPath)
		dispatch(types.CHANGE_DOWNLOADPATH, downloadPath.toString())
	else
		dispatch(types.ADD_SNACK, {message: '修改失败'})
}

export const selectPicItem = ({dispatch}, index) => {
	dispatch(types.SELECT_PICITEM, index)
}

export const changeProxy = ({dispatch}, e) => {
	dispatch(types.CHANGE_PROXY, e.target.value)
}

export const changeUserName = ({dispatch}, e) => {
	dispatch(types.CHANGE_USER_NAME, e.target.value)
}

export const changePassWord = ({dispatch}, e) => {
	dispatch(types.CHANGE_PASS_WORD, e.target.value)
}

export const getUserInfo = ({dispatch}) => {
	ipcRenderer.send('get-userinfo-m')
	ipcRenderer.once('get-userinfo-r', (e, userinfo) => {
		console.log(userinfo, 'userinfo')
		if (userinfo)
			dispatch(types.GET_USER_INFO, userinfo)
		else
			dispatch(types.ADD_SNACK, {message: '无缓存'})
	})
}

export const logoutAsync = ({dispatch}) => {
	ipcRenderer.send('logout-m')
	ipcRenderer.once('logout-r', (e, err) => {
		if (!err)
			dispatch(types.LOGOUT)
		else
			dispatch(types.ADD_SNACK, {message: err})
	})
}

export const loginAsync = ({dispatch}, userinfo) => {
	console.log({...userinfo})
	dispatch(types.LOADING_START)
	//必须解构，否则主线程接收到空对象
	ipcRenderer.send('login-m', {...userinfo})
	ipcRenderer.once('login-r', (e, logined, err) => {
		if (!logined && err)
			dispatch(types.ADD_SNACK, {message: err})
		dispatch(types.LOGIN, logined)
		dispatch(types.LOADING_END)
	})
}

export const authorizeLoginAsync = ({dispatch}, cookie) => {
	ipcRenderer.send('set-option-m', {cookie})
	ipcRenderer.once('set-option-r', (e, err) => {
		if (err)
			dispatch(types.ADD_SNACK, {message: err})
		dispatch(types.LOGIN, true)
	})
}

export const setOption = ({dispatch}, option) => {
	ipcRenderer.send('set-option-m', {...option})
	ipcRenderer.once('set-option-r', (e, err) => {
		if (err)
			dispatch(types.ADD_SNACK, {message: err})
		dispatch(types.SET_OPTION)
	})
}

export const searchAsync = ({dispatch}, authorId, refresh) => {
	dispatch(types.LOADING_START)
	//获取缓存图片列表
	ipcRenderer.send('get-thumbList-from-cache-m', authorId)
	ipcRenderer.once('get-thumbList-from-cache-r', (e, picList) => {
		//当本地缓存不存在或强制刷新时
		if (!picList.length || refresh) {
			//查找缩略图
			ipcRenderer.send('get-thumbList-from-net-m', authorId)
			ipcRenderer.once('get-thumbList-from-net-r', (e, picList) => {
				thumbListFactory(picList)
			})
		} else {
			thumbListFactory(picList)
		}
	})
}

export const downloadPicListAsync = ({dispatch}, authorId, picList) => {
	if (!picList.length)
		return
	//发送前写入编号
	const newPicList = picList.map((v, i) => {
		v.index = i
		return v
	}).filter(v => v.selected)
	ipcRenderer.send('download-picList-m', authorId, JSON.parse(JSON.stringify(newPicList)))
}

export const addSnack = ({dispatch}, option) => {
	dispatch(types.ADD_SNACK, option)
}


//缩略图加工厂，添加必要的属性
function thumbListFactory(picList) {
	if (!picList.length)
		store.dispatch(types.ADD_SNACK, {message: '尚无此作者 或 该作者尚未存在作品'})
	picList.forEach(v => {
		v.selected = false
		v.width = 150
		v.height = 0
		v.progress = 0
	})
	store.dispatch(types.LOADING_END)
	store.dispatch(types.SEARCH_PICLIST, picList)
}

ipcRenderer.on('download-progress-r', (e, pic, progress) => {
	//获取带有编号的图片
	store.dispatch(types.CHANGE_PICITEM_PROGREE, pic.index, progress)
})

ipcRenderer.on('download-finished-r', (e, pic) => {
	if (pic.name.includes('master'))
		store.dispatch(types.SEARCH_PICTURE, pic)
})

ipcRenderer.on('login-timeout', () => {
	store.dispatch(types.ADD_SNACK, {message: 'cookie过期'})
	store.dispatch(types.LOGIN_TIMEOUT)
	store.dispatch(types.LOADING_END)
})
